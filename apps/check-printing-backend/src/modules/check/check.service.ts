import { randomUUID } from "crypto";
import { CheckRepository } from "./check.repository.js";
import { AuditService } from "../../shared/services/audit.service.js";
import {
  AppError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/index.js";
import { logger } from "../../shared/services/logger.js";
import {
  assertTransition,
  amountToWords,
  validateCheckDateRange,
} from "./check.helpers.js";
import type {
  CreateCheckInput,
  UpdateCheckInput,
  ClearCheckInput,
  PrintCheckInput,
  PrintBatchInput,
  PrintOutcomeInput,
} from "./check.schemas.js";
import type { AuditContext } from "./check.types.js";
import type { PdfService, StoredPdf } from "../pdf/pdf.service.js";
import type { CalibrationService } from "../calibration/calibration.service.js";
import type { PrintCalibration } from "../calibration/calibration.types.js";
import type { EncryptionService } from "../../shared/services/encryption.service.js";
import { planSheets, templateForPrinter } from "../pdf/pdf.templates.js";
import { assertMicrPrintable } from "../../shared/utils/micr-validation.js";
import type { CheckPdfData, SheetPosition } from "../pdf/pdf.types.js";
import type { ObjectStorage } from "../../shared/storage/index.js";
import type { CheckPrintingSettingsService } from "../check-printing-settings/check-printing-settings.service.js";
import { ruleLabel } from "../approval-rule/rule-satisfiability.js";
import { formatAttachment } from "./attachment.service.js";
import { Prisma } from "@smartbusiness/database";
import type { CheckStatus, VoidType } from "@smartbusiness/database";

// Shown when a printed check is voided: our records change, the bank's do not.
function stopPaymentNotice(checkNumber: number): string {
  return `Check #${checkNumber} was printed. If it was sent or may be cashed, contact your bank to place a stop payment on it.`;
}

// Shown when a print is reported spoiled: one number, one paper, always.
function spoiledNotice(checkNumber: number): string {
  return `Destroy the spoiled paper for check #${checkNumber}. To pay this payee, reissue the check: it gets a new number.`;
}

// "Check #1042 is ___": why a check is not (or no longer) printable.
const STATUS_WORDS: Record<CheckStatus, string> = {
  NEW: "a draft",
  PENDING_APPROVAL: "waiting for approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  PRINTED: "already printed",
  VOID: "void",
  CLEARED: "cleared",
};

// Print order: check number, then bank account (numbers repeat across accounts).
function byCheckNumber(a: { checkNumber: number; bankAccountId: string }, b: { checkNumber: number; bankAccountId: string }) {
  return a.checkNumber - b.checkNumber || a.bankAccountId.localeCompare(b.bankAccountId);
}

// A print job's PDF holds every check in it: handing it out again is safe only while
// each of them is still PRINTED (not void, not cleared, not deleted).
function batchPdfAvailable(batch: { checkCount: number; checks: Array<{ status: CheckStatus }> }): boolean {
  return batch.checks.length === batch.checkCount && batch.checks.every((c) => c.status === "PRINTED");
}

// What one bank account contributes to every check of a print job.
interface PrintAccount {
  bankName: string;
  checkNumberPadding: number;
  routingNumber: string;
  accountNumber: string;
  signatureImage: Buffer | null;
}

// Shared by every check of one print (single or batch).
interface PrintSetup {
  workspace: NonNullable<Awaited<ReturnType<CheckRepository["findWorkspace"]>>>;
  printer: PrintCalibration;
  accounts: Map<string, PrintAccount>;
}

// A check can be edited only before it enters approval, or after a rejection.
const EDITABLE_STATUSES: CheckStatus[] = ["NEW", "REJECTED"];

export class CheckService {
  constructor(
    private checkRepository: CheckRepository,
    private auditService: AuditService,
    private pdfService: PdfService,
    private calibrationService: CalibrationService,
    private encryptionService: EncryptionService,
    private fileStorage: ObjectStorage,
    private settingsService: CheckPrintingSettingsService,
  ) {}

  // ═════════════════════════════════════════════════════════════
  // CREATE CHECK
  //
  // The most complex operation in the module. Steps:
  //
  // 1. Verify bank account exists AND belongs to this workspace
  //    (IDOR prevention — without this, a user could create a
  //    check against someone else's bank account by guessing IDs)
  //
  // 2. Load workspace settings for amount/date validation
  //
  // 3. Validate amount against workspace max
  //
  // 4. Validate check date against allowed range
  //
  // 5. Convert amount to words (legally binding per UCC 3-114)
  //
  // 6. Determine initial status:
  //    - If approvalEnabled is OFF → always NEW
  //    - If ON, check ApprovalWorkflowRules for matching amount
  //    - No matching rule → NEW (can print immediately)
  //    - Matching rule → PENDING_APPROVAL (needs approval first)
  //
  // 7. Create check with atomic number assignment
  //
  // 8. Log to audit trail
  // ═════════════════════════════════════════════════════════════

  async createCheck(
    workspaceId: string,
    input: CreateCheckInput,
    ctx: AuditContext,
  ) {
    await this.requireActiveBankAccount(input.bankAccountId, workspaceId, "write checks from it");

    const settings = await this.requireSettings(workspaceId);
    this.assertAmountWithinLimit(input.amount, settings);
    this.assertDateWithinRange(input.checkDate, settings);

    const words = amountToWords(input.amount);

    const routedStatus = await this.determineInitialStatus(
      workspaceId,
      input.amount,
      settings.approvalEnabled,
    );
    // A draft waits for its creator to submit it (after attaching invoices).
    const initialStatus: CheckStatus = input.saveAsDraft ? "NEW" : routedStatus;

    const check = await this.checkRepository.createWithAtomicNumber(
      {
        workspaceId,
        bankAccountId: input.bankAccountId,
        payeeName: input.payeeName,
        amount: input.amount,
        amountInWords: words,
        checkDate: input.checkDate,
        memo: input.memo,
        invoiceTableJson: input.invoiceItems ?? null,
        createdById: ctx.userId,
      },
      initialStatus,
      ctx.userId,
      ctx.ipAddress,
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_CREATED",
      entityType: "Check",
      entityId: check.id,
      details: {
        checkNumber: check.checkNumber,
        amount: input.amount,
        payeeName: input.payeeName,
        initialStatus,
        savedAsDraft: Boolean(input.saveAsDraft),
        bankAccountId: input.bankAccountId,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.withApprovalRequirement(this.formatCheck(check), workspaceId);
  }

  // ═════════════════════════════════════════════════════════════
  // GET SINGLE CHECK
  // ═════════════════════════════════════════════════════════════

  async getCheck(checkId: string, workspaceId: string) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }
    return this.withApprovalRequirement(this.formatCheck(check), workspaceId);
  }

  // For a NEW check: does its amount need approval before it can be printed? The app shows
  // "Submit for approval" or "Print" from this. null for every other status.
  private async withApprovalRequirement<T extends { status: string; amount: string }>(check: T, workspaceId: string) {
    if (check.status !== "NEW") return { ...check, approvalRequired: null };
    return { ...check, approvalRequired: await this.needsApproval(workspaceId, Number(check.amount)) };
  }

  private async needsApproval(workspaceId: string, amount: number): Promise<boolean> {
    const settings = await this.settingsService.forWorkspace(workspaceId);
    if (!settings.approvalEnabled) return false;
    return (await this.findMatchingRule(workspaceId, amount)) !== null;
  }

  // ═════════════════════════════════════════════════════════════
  // APPROVAL QUEUE
  //
  // Returns checks the current user can actually approve.
  //
  // Filtering pipeline (all in-memory after fetching):
  //
  // 1. Fetch ALL pending checks (no pre-filtering)
  // 2. Fetch active rules with designated approvers
  // 3. Fetch which checks the user has already voted on
  // 4. For each check, find its matching rule by amount range
  // 5. Exclude if:
  //    - User already voted on this check
  //    - Rule has designated approvers and user isn't one
  //    - User is the creator and rule doesn't allow self-approval
  //
  // Why filter in the service instead of SQL?
  // The matching logic (amount range → rule → approvers) requires
  // joining checks with rules via a range comparison, then checking
  // a junction table. Doing this in SQL would be a complex
  // subquery that's hard to read and maintain. The approval queue
  // is typically small (tens of checks, not thousands), so
  // in-memory filtering is fast and correct.
  // ═════════════════════════════════════════════════════════════

  async getApprovalQueue(workspaceId: string, userId: string) {
    const [allPending, rules] = await Promise.all([
      this.checkRepository.listPendingApproval(workspaceId),
      this.checkRepository.findApprovalRules(workspaceId),
    ]);

    if (allPending.length === 0) {
      return [];
    }

    const checkIds = allPending.map((c: any) => c.id as string);
    const userDecisions = await this.checkRepository.findUserDecisionsForChecks(
      checkIds,
      userId,
    );
    const alreadyVotedOn = new Set(userDecisions.map((d) => `${d.checkId}:${d.round}`));

    const filtered = allPending.filter((check: any) => {
      if (alreadyVotedOn.has(`${check.id}:${check.approvalRound}`)) return false;

      const matchedRule = rules.find((rule) => {
        const min = rule.minAmount ? Number(rule.minAmount) : 0;
        const max = rule.maxAmount ? Number(rule.maxAmount) : Infinity;
        return Number(check.amount) >= min && Number(check.amount) <= max;
      });

      if (matchedRule && matchedRule.approvers.length > 0) {
        const isDesignated = matchedRule.approvers.some(
          (a) => a.userId === userId,
        );
        if (!isDesignated) return false;
      }

      if (check.createdById === userId) {
        const selfAllowed = matchedRule?.allowSelfApproval ?? false;
        if (!selfAllowed) return false;
      }

      return true;
    });

    return filtered.map((item: any) => this.formatCheckListItem(item));
  }

  // ═════════════════════════════════════════════════════════════
  // UPDATE CHECK (edit draft)
  //
  // Business rules:
  // - Only checks in NEW or REJECTED status can be edited
  // - Only the creator can edit their own check
  // - If amount changes, recalculate amountInWords
  // - If amount changes, re-validate against workspace max
  // ═════════════════════════════════════════════════════════════

  async updateCheck(
    checkId: string,
    workspaceId: string,
    input: UpdateCheckInput,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    if (!EDITABLE_STATUSES.includes(check.status)) {
      throw new ValidationError(
        "Only draft or rejected checks can be edited",
        { status: [`Check is in ${check.status} status`] },
      );
    }

    if (check.createdById !== ctx.userId) {
      throw new ValidationError(
        "You can only edit checks you created",
        { authorization: ["Only the creator can edit this check"] },
      );
    }

    const updateData: Prisma.CheckUncheckedUpdateManyInput = {};

    if (input.payeeName !== undefined) {
      updateData.payeeName = input.payeeName;
    }

    if (input.amount !== undefined || input.checkDate !== undefined) {
      const settings = await this.requireSettings(workspaceId);

      if (input.amount !== undefined) {
        this.assertAmountWithinLimit(input.amount, settings);
        updateData.amount = input.amount;
        updateData.amountInWords = amountToWords(input.amount);
      }

      if (input.checkDate !== undefined) {
        this.assertDateWithinRange(input.checkDate, settings);
        updateData.checkDate = input.checkDate;
      }
    }

    if (input.memo !== undefined) {
      updateData.memo = input.memo;
    }

    if (input.invoiceItems !== undefined) {
      updateData.invoiceTableJson = input.invoiceItems ?? Prisma.JsonNull;
    }

    const updated = await this.checkRepository.updateDraft(
      checkId,
      workspaceId,
      ctx.userId,
      EDITABLE_STATUSES,
      updateData,
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_UPDATED",
      entityType: "Check",
      entityId: checkId,
      details: { fields: Object.keys(updateData) },
      ipAddress: ctx.ipAddress,
    });

    return this.withApprovalRequirement(this.formatCheck(updated), workspaceId);
  }

  // ═════════════════════════════════════════════════════════════
  // SUBMIT FOR APPROVAL
  //
  // Transitions: NEW → PENDING_APPROVAL
  //
  // Why not auto-submit on create? Because the user might want
  // to review the check before submitting. This gives them a
  // "save draft" workflow.
  // ═════════════════════════════════════════════════════════════

  async submitForApproval(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "PENDING_APPROVAL");

    // No rule covers this amount, so no approver would ever see it in their queue: it
    // would wait forever. It can be printed as it is.
    if (!(await this.needsApproval(workspaceId, Number(check.amount)))) {
      throw new AppError(
        `Check #${check.checkNumber} doesn't need approval, so it can't wait for one. Print it directly.`,
        409,
        "APPROVAL_NOT_REQUIRED",
      );
    }

    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "PENDING_APPROVAL",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "PENDING_APPROVAL",
        changedById: ctx.userId,
        ipAddress: ctx.ipAddress,
      },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_SUBMITTED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // APPROVE CHECK
  //
  // The full approval pipeline:
  //
  // 1. STATE MACHINE: Only PENDING_APPROVAL → APPROVED
  //
  // 2. FIND MATCHING RULE: Same priority-based range matching
  //    used by determineInitialStatus. If no rule matches (edge
  //    case: rules changed after check was created), approve
  //    without recording against a specific rule.
  //
  // 3. DESIGNATED APPROVER CHECK: If the matched rule has
  //    designated approvers (ApprovalWorkflowApprover entries),
  //    the current user MUST be one of them. If the rule has NO
  //    designated approvers, any user with check:approve
  //    permission can approve (open approval).
  //
  // 4. SEPARATION OF DUTIES with allowSelfApproval:
  //    - Default (allowSelfApproval=false): creator ≠ approver
  //    - Solo-user escape (allowSelfApproval=true): creator
  //      CAN approve their own check. This prevents the
  //      deadlock where a single user can't process checks.
  //    - If no rule matched, default to blocking self-approval.
  //
  // 5. DOUBLE-VOTE PREVENTION: A user who already voted
  //    (approved or rejected) on this check cannot vote again.
  //
  // 6. MULTI-APPROVAL: If the rule requires N approvals and
  //    we haven't reached that count yet, create the record
  //    but keep the check in PENDING_APPROVAL. Once the Nth
  //    approval arrives, transition to APPROVED.
  // ═════════════════════════════════════════════════════════════

  async approveCheck(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "APPROVED");

    const matchedRule = await this.findMatchingRule(workspaceId, Number(check.amount));

    this.enforceApproverAccess(matchedRule, check.createdById, ctx.userId);

    await this.assertNotYetDecided(check, ctx.userId);

    const result = await this.checkRepository.recordDecision({
      checkId,
      workspaceId,
      fromStatus: check.status,
      round: check.approvalRound,
      rule: matchedRule,
      decision: "approved",
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
    });

    if (!result.transitioned) {
      await this.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        workspaceId,
        action: "CHECK_APPROVAL_RECORDED",
        entityType: "Check",
        entityId: checkId,
        details: {
          checkNumber: check.checkNumber,
          ruleId: matchedRule?.id ?? null,
          round: check.approvalRound,
          approvedCount: result.approvedCount,
          requiredApprovals: matchedRule?.requiredApprovals ?? null,
        },
        ipAddress: ctx.ipAddress,
      });

      return this.formatCheck(result.check);
    }

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_APPROVED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        amount: Number(check.amount),
        ruleId: matchedRule?.id ?? null,
        round: check.approvalRound,
        approvedCount: result.approvedCount,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(result.check);
  }

  // ═════════════════════════════════════════════════════════════
  // REJECT CHECK
  //
  // Same approver checks as approveCheck: designated approver
  // enforcement, allowSelfApproval, double-vote prevention.
  //
  // Key difference: rejection is IMMEDIATE. Unlike approval
  // which may require multiple approvers (requiredApprovals > 1),
  // a single rejection moves the check to REJECTED. Rationale:
  // if even one approver says "no," the check needs to be fixed.
  // The creator can then edit and resubmit.
  // ═════════════════════════════════════════════════════════════

  async rejectCheck(
    checkId: string,
    workspaceId: string,
    reason: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "REJECTED");

    const matchedRule = await this.findMatchingRule(workspaceId, Number(check.amount));

    this.enforceApproverAccess(matchedRule, check.createdById, ctx.userId);

    await this.assertNotYetDecided(check, ctx.userId);

    const { check: updated } = await this.checkRepository.recordDecision({
      checkId,
      workspaceId,
      fromStatus: check.status,
      round: check.approvalRound,
      rule: matchedRule,
      decision: "rejected",
      reason,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_REJECTED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        reason,
        ruleId: matchedRule?.id ?? null,
        round: check.approvalRound,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // RESUBMIT CHECK (after rejection)
  //
  // Transitions: REJECTED → PENDING_APPROVAL
  //
  // Only the creator can resubmit. They may have edited the
  // check to address the rejection reason before resubmitting.
  // ═════════════════════════════════════════════════════════════

  async resubmitCheck(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "PENDING_APPROVAL");

    if (check.createdById !== ctx.userId) {
      throw new ValidationError(
        "Only the check creator can resubmit",
        { authorization: ["You did not create this check"] },
      );
    }

    // A new round: votes from before the edit no longer count, and the
    // approver who rejected may vote again.
    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "PENDING_APPROVAL",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "PENDING_APPROVAL",
        changedById: ctx.userId,
        ipAddress: ctx.ipAddress,
      },
      { approvalRound: { increment: 1 } },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_RESUBMITTED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber, round: updated.approvalRound },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // PRINT CHECK
  //
  // Generates the check PDF and transitions to PRINTED.
  //
  // Pipeline:
  // 1. Load check and validate transition, and that it needs no (more) approval
  // 2. Resolve the printer profile (chosen, else workspace default):
  //    paper size + calibration offsets, and the slot on three-per-page paper
  // 3. Build CheckPdfData (bank account decrypted, MICR line checked) and render
  // 4. Update check status to PRINTED with PDF path and print snapshot
  // 5. Audit log
  // ═════════════════════════════════════════════════════════════

  async printCheck(
    checkId: string,
    workspaceId: string,
    input: PrintCheckInput,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "PRINTED");
    const approval = await this.approvalForPrint(check);

    const setup = await this.printSetup(workspaceId, input.calibrationProfileId);
    const { printer } = setup;
    const isThreePerPage = printer.layout === "THREE_PER_PAGE";
    this.assertSlotAllowed(printer, input.position);
    // Slots exist only on three-per-page paper; there the default is the top slot.
    const position = isThreePerPage ? ((input.position ?? 1) as SheetPosition) : null;

    const pdfData = await this.pdfDataFor(check, position, setup);
    const stored = await this.pdfService.generateCheckPdf(pdfData, workspaceId, checkId);

    let updated;
    try {
      updated = await this.checkRepository.updateStatus(
        checkId,
        workspaceId,
        "PRINTED",
        {
          checkId,
          fromStatus: check.status,
          toStatus: "PRINTED",
          changedById: ctx.userId,
          ipAddress: ctx.ipAddress,
        },
        this.printedFields(printer, position, stored, ctx.userId),
      );
    } catch (err) {
      // Another request printed this check first (or the update failed): this
      // attempt's PDF was never recorded, so it must not linger on disk.
      await this.pdfService.deleteStoredPdf(stored.key).catch((cleanupErr: unknown) => {
        logger.error({ err: cleanupErr, checkId }, "Failed to remove PDF of an unrecorded print attempt");
      });
      throw err;
    }

    if (position) {
      await this.calibrationService.recordNextSlot(workspaceId, printer.profileId, ((position % 3) + 1) as SheetPosition);
    }

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_PRINTED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        approval,
        pdfStorageKey: stored.key,
        pdfSha256: stored.sha256,
        printer: this.printerDetails(printer, position),
      },
      ipAddress: ctx.ipAddress,
    });

    // Three-per-page paper has no stubs, so invoice lines have nowhere to go.
    const invoiceLines = (check.invoiceTableJson as unknown[] | null)?.length ?? 0;
    const notice =
      isThreePerPage && invoiceLines > 0
        ? "This printer's paper has no stubs, so the invoice lines were not printed. Send the invoice to the payee separately if they need it."
        : null;

    return { ...this.formatCheck(updated), notice };
  }

  // ═════════════════════════════════════════════════════════════
  // PRINT A BATCH (several checks, one PDF)
  //
  // All or nothing, because a print job is one stack of paper:
  // 1. Every check is validated first (status, approval, bank account, MICR line,
  //    payee fits) and rendered on its own. If any one cannot print, nothing is
  //    stored or changed, and the error lists every problem by check number.
  // 2. Checks are printed in check-number order. On three-per-page paper they fill
  //    the sheet in the tray from `startPosition`, then carry on onto fresh sheets.
  // 3. Each check keeps its own one-check PDF (so it can be downloaded alone), and
  //    the job gets one PDF with every sheet.
  // 4. One transaction records the batch and moves every check to PRINTED; if any
  //    check was changed meanwhile, it rolls back and the stored PDFs are deleted.
  // 5. Each check's print is confirmed (or reported spoiled) afterwards, one by one,
  //    exactly like a single print.
  // ═════════════════════════════════════════════════════════════

  async printBatch(workspaceId: string, input: PrintBatchInput, ctx: AuditContext) {
    const found = await this.checkRepository.findManyForPrint(input.checkIds, workspaceId);
    if (found.length !== input.checkIds.length) {
      throw new NotFoundError("One or more of the chosen checks");
    }
    const checks = [...found].sort(byCheckNumber);

    const setup = await this.printSetup(workspaceId, input.calibrationProfileId);
    const { printer } = setup;
    this.assertSlotAllowed(printer, input.startPosition, "startPosition");
    const isThreePerPage = printer.layout === "THREE_PER_PAGE";
    const startPosition = isThreePerPage ? ((input.startPosition ?? 1) as SheetPosition) : null;
    const plan = planSheets(checks.length, printer.layout, startPosition ?? 1);

    // 1. Validate and render every check before anything is stored.
    const problems: Record<string, string[]> = {};
    const prepared: Array<{
      check: (typeof checks)[number];
      approval: Awaited<ReturnType<CheckService["approvalForPrint"]>>;
      pdfData: CheckPdfData;
      pdf: Buffer;
      position: SheetPosition | null;
      sheet: number;
    }> = [];
    for (const [i, check] of checks.entries()) {
      const { position, sheet } = plan.placements[i]!;
      try {
        if (check.status !== "APPROVED" && check.status !== "NEW") {
          throw new ConflictError(`Check #${check.checkNumber} is ${STATUS_WORDS[check.status]}, so it can't be printed.`);
        }
        const approval = await this.approvalForPrint(check);
        const pdfData = await this.pdfDataFor(check, position, setup);
        const pdf = await this.pdfService.renderCheck(pdfData);
        prepared.push({ check, approval, pdfData, pdf, position, sheet });
      } catch (err) {
        // A problem with this check (4xx); anything else (a server fault) stops the job.
        if (!(err instanceof AppError) || err.statusCode >= 500) throw err;
        // Every message names its check, so the person can find it in the list.
        const named = err.message.includes(`#${check.checkNumber}`);
        problems[check.id] = [named ? err.message : `Check #${check.checkNumber}: ${err.message}`];
      }
    }
    const problemCount = Object.keys(problems).length;
    if (problemCount > 0) {
      throw new ValidationError(
        `${problemCount} of the ${checks.length} checks can't be printed, so nothing was printed. ` +
          "Fix them or leave them out, then print again.",
        problems,
      );
    }

    // 2–3. Store each check's own PDF and the job's PDF.
    const batchId = randomUUID();
    const storedKeys: string[] = [];
    const cleanUp = async () => {
      await Promise.all(
        storedKeys.map((key) =>
          this.pdfService.deleteStoredPdf(key).catch((cleanupErr: unknown) => {
            logger.error({ err: cleanupErr, batchId, key }, "Failed to remove PDF of an unrecorded print job");
          }),
        ),
      );
    };

    let batchPdf: StoredPdf;
    const perCheck: StoredPdf[] = [];
    try {
      for (const p of prepared) {
        const stored = await this.pdfService.storeCheckPdf(p.pdf, workspaceId, p.check.id);
        storedKeys.push(stored.key);
        perCheck.push(stored);
      }
      const sheets: CheckPdfData[][] = Array.from({ length: plan.sheetCount }, () => []);
      for (const p of prepared) sheets[p.sheet]!.push(p.pdfData);
      batchPdf = await this.pdfService.generateBatchPdf(sheets, workspaceId, batchId);
      storedKeys.push(batchPdf.key);
    } catch (err) {
      await cleanUp();
      throw err;
    }

    // 4. Record the job and every check, all or nothing.
    const printedAt = new Date();
    let updated;
    try {
      updated = await this.checkRepository.recordBatchPrint(
        {
          id: batchId,
          workspaceId,
          calibrationProfileId: printer.profileId,
          checkCount: prepared.length,
          sheetCount: plan.sheetCount,
          paperSize: printer.paperSize,
          layout: printer.layout,
          startPosition,
          nextPosition: plan.nextPosition,
          pdfStorageUrl: batchPdf.key,
          pdfSha256: batchPdf.sha256,
          createdById: ctx.userId,
        },
        prepared.map((p, i) => ({
          checkId: p.check.id,
          checkNumber: p.check.checkNumber,
          fromStatus: p.check.status,
          data: { ...this.printedFields(printer, p.position, perCheck[i]!, ctx.userId), printedAt },
        })),
        { changedById: ctx.userId, ipAddress: ctx.ipAddress },
      );
    } catch (err) {
      await cleanUp();
      throw err;
    }

    if (plan.nextPosition) {
      await this.calibrationService.recordNextSlot(workspaceId, printer.profileId, plan.nextPosition);
    }

    // 5. Audit: one entry per check (each is a negotiable instrument) and one for the job.
    for (const [i, p] of prepared.entries()) {
      await this.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        workspaceId,
        action: "CHECK_PRINTED",
        entityType: "Check",
        entityId: p.check.id,
        details: {
          checkNumber: p.check.checkNumber,
          approval: p.approval,
          pdfStorageKey: perCheck[i]!.key,
          pdfSha256: perCheck[i]!.sha256,
          printBatchId: batchId,
          sheet: p.sheet + 1,
          printer: this.printerDetails(printer, p.position),
        },
        ipAddress: ctx.ipAddress,
      });
    }
    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "PRINT_BATCH_CREATED",
      entityType: "PrintBatch",
      entityId: batchId,
      details: {
        checkNumbers: prepared.map((p) => p.check.checkNumber),
        sheetCount: plan.sheetCount,
        startPosition,
        nextPosition: plan.nextPosition,
        pdfStorageKey: batchPdf.key,
        pdfSha256: batchPdf.sha256,
        printer: this.printerDetails(printer, null),
      },
      ipAddress: ctx.ipAddress,
    });

    const byId = new Map(updated.map((c) => [c.id, c]));
    const withInvoiceLines = isThreePerPage
      ? prepared.filter((p) => ((p.check.invoiceTableJson as unknown[] | null)?.length ?? 0) > 0)
      : [];
    const notice =
      withInvoiceLines.length > 0
        ? `This printer's paper has no stubs, so the invoice lines of ${withInvoiceLines
            .map((p) => `#${p.check.checkNumber}`)
            .join(", ")} were not printed. Send those invoices to the payees separately if they need them.`
        : null;

    return {
      batch: {
        id: batchId,
        checkCount: prepared.length,
        sheetCount: plan.sheetCount,
        paperSize: printer.paperSize,
        layout: printer.layout,
        startPosition,
        nextPosition: plan.nextPosition,
        calibrationProfileId: printer.profileId,
        createdAt: printedAt,
      },
      checks: prepared.map((p) => ({ ...this.formatCheck(byId.get(p.check.id)), sheet: p.sheet + 1 })),
      notice,
    };
  }

  // A print job and its checks, for the page that reports how each one came out.
  async getPrintBatch(batchId: string, workspaceId: string) {
    const batch = await this.checkRepository.findPrintBatch(batchId, workspaceId);
    if (!batch) {
      throw new NotFoundError("Print job");
    }
    const checks = [...batch.checks].sort(byCheckNumber);
    return {
      id: batch.id,
      checkCount: batch.checkCount,
      sheetCount: batch.sheetCount,
      paperSize: batch.paperSize,
      layout: batch.layout,
      startPosition: batch.startPosition,
      nextPosition: batch.nextPosition,
      calibrationProfileId: batch.calibrationProfileId,
      createdBy: batch.createdBy,
      createdAt: batch.createdAt,
      // The job's PDF is handed out only while every check in it is still PRINTED.
      pdfAvailable: batchPdfAvailable(batch),
      checks: checks.map((c) => ({
        ...this.formatCheckListItem(c),
        printedAt: c.printedAt,
        printConfirmedAt: c.printConfirmedAt,
        voidType: c.voidType,
        position: c.printPosition,
      })),
    };
  }

  // The job's PDF, under the same rules as a single check's: verified against its
  // SHA-256, audited before it leaves, and refused once any check in it is void or
  // has cleared (printing the job again would duplicate that check).
  async downloadBatchPdf(batchId: string, workspaceId: string, ctx: AuditContext) {
    const batch = await this.checkRepository.findPrintBatch(batchId, workspaceId);
    if (!batch) {
      throw new NotFoundError("Print job");
    }

    if (!batchPdfAvailable(batch)) {
      const named = batch.checks
        .filter((c) => c.status !== "PRINTED")
        .sort(byCheckNumber)
        .map((c) => `#${c.checkNumber} is ${STATUS_WORDS[c.status]}`)
        .join(", ");
      throw new AppError(
        `This print job's PDF can no longer be downloaded${named ? ` (${named})` : ""}. ` +
          "Download the checks that are still printed one at a time from their own pages.",
        409,
        "PRINT_BATCH_PDF_UNAVAILABLE",
      );
    }

    const buffer = await this.pdfService.readVerifiedPdf(batch.pdfStorageUrl, batch.pdfSha256);

    // Written before the bytes leave the server: no audit row, no download.
    await this.auditService.logOrRefuse({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "PRINT_BATCH_PDF_DOWNLOADED",
      entityType: "PrintBatch",
      entityId: batchId,
      details: { checkNumbers: batch.checks.map((c) => c.checkNumber).sort((a, b) => a - b), pdfSha256: batch.pdfSha256 },
      ipAddress: ctx.ipAddress,
    });

    return buffer;
  }

  // The printer, and everything about the workspace that every check of a job shares.
  private async printSetup(workspaceId: string, calibrationProfileId?: string): Promise<PrintSetup> {
    const workspace = await this.checkRepository.findWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace");
    }
    const printer = await this.calibrationService.resolveForPrint(workspaceId, calibrationProfileId);
    return { workspace, printer, accounts: new Map() };
  }

  private assertSlotAllowed(printer: PrintCalibration, slot: number | undefined, field = "position") {
    if (slot !== undefined && printer.layout !== "THREE_PER_PAGE") {
      throw new ValidationError(
        `"${printer.profileName}" prints one check per sheet, so there is no slot to choose.`,
        { [field]: ["Only printers with three-per-page paper have slots"] },
      );
    }
  }

  // The bank account of a print: loaded, decrypted and its signature read once per job.
  private async printAccount(bankAccountId: string, workspaceId: string, checkNumber: number, setup: PrintSetup) {
    const cached = setup.accounts.get(bankAccountId);
    if (cached) return cached;

    const bankAccount = await this.requireActiveBankAccount(bankAccountId, workspaceId, `print check #${checkNumber}`);
    const account: PrintAccount = {
      bankName: bankAccount.bankName,
      checkNumberPadding: bankAccount.checkNumberPadding ?? 6,
      routingNumber: this.encryptionService.decrypt(bankAccount.routingNumberEncrypted),
      accountNumber: this.encryptionService.decrypt(bankAccount.accountNumberEncrypted),
      signatureImage: await this.loadSignature(bankAccount.signatureStorageKey),
    };
    setup.accounts.set(bankAccountId, account);
    return account;
  }

  // Everything drawn on one check, in the slot it goes into.
  private async pdfDataFor(
    check: NonNullable<Awaited<ReturnType<CheckRepository["findById"]>>>,
    position: SheetPosition | null,
    setup: PrintSetup,
  ): Promise<CheckPdfData> {
    const { workspace, printer } = setup;
    const account = await this.printAccount(check.bankAccountId, check.workspaceId, check.checkNumber, setup);
    const { routingNumber, accountNumber } = account;

    const paddedCheckNumber = String(check.checkNumber).padStart(account.checkNumberPadding, "0");

    assertMicrPrintable({ routingNumber, accountNumber, checkNumber: paddedCheckNumber });

    // checkDate is a @db.Date, delivered as UTC midnight; local getters would shift it a day in US time zones.
    const checkDate = new Date(check.checkDate);
    const formattedDate = [
      String(checkDate.getUTCMonth() + 1).padStart(2, "0"),
      String(checkDate.getUTCDate()).padStart(2, "0"),
      String(checkDate.getUTCFullYear()),
    ].join("/");

    const formattedAmount = parseFloat(check.amount.toString()).toLocaleString(
      "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );

    const companyAddress = workspace.addressLine1 +
      (workspace.addressLine2 ? `, ${workspace.addressLine2}` : "");
    const companyCityStateZip =
      `${workspace.city}, ${workspace.state} ${workspace.zipCode}`;

    return {
      checkNumber: paddedCheckNumber,
      payeeName: check.payeeName,
      amount: formattedAmount,
      amountInWords: check.amountInWords,
      checkDate: formattedDate,
      memo: check.memo,
      routingNumber,
      accountNumber,
      bankName: account.bankName,
      checkNumberPadding: account.checkNumberPadding,
      companyName: workspace.businessName,
      companyAddress,
      companyCityStateZip,
      horizontalOffsetPts: printer.horizontalOffsetPts,
      verticalOffsetPts: printer.verticalOffsetPts,
      signatureImage: account.signatureImage,
      template: templateForPrinter({ ...printer, position: position ?? undefined }),
      // The API stores line amounts as JSON numbers (older rows may hold strings); the PDF
      // prints them as "1650.00", so normalise here rather than trust the stored type.
      invoiceItems: Array.isArray(check.invoiceTableJson)
        ? (check.invoiceTableJson as Array<{ description: string; amount: number | string }>).map((item) => ({
            description: String(item.description ?? ""),
            amount: Number(item.amount).toFixed(2),
          }))
        : null,
    };
  }

  // The print snapshot stored on a printed check.
  private printedFields(printer: PrintCalibration, position: SheetPosition | null, stored: StoredPdf, userId: string) {
    return {
      printedAt: new Date(),
      printedById: userId,
      pdfStorageUrl: stored.key,
      pdfSha256: stored.sha256,
      calibrationProfileId: printer.profileId,
      printOffsetXPts: printer.horizontalOffsetPts,
      printOffsetYPts: printer.verticalOffsetPts,
      printPaperSize: printer.paperSize,
      printLayout: printer.layout,
      printPosition: position,
    };
  }

  private printerDetails(printer: PrintCalibration, position: SheetPosition | null) {
    return {
      profileId: printer.profileId,
      profileName: printer.profileName,
      paperSize: printer.paperSize,
      layout: printer.layout,
      position,
      horizontalOffsetPts: printer.horizontalOffsetPts,
      verticalOffsetPts: printer.verticalOffsetPts,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // GET PDF BUFFER (for download endpoint)
  // ═════════════════════════════════════════════════════════════

  async downloadCheckPdf(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<{ buffer: Buffer; checkNumber: number }> {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    // The PDF is a negotiable instrument. Once a check is void or has cleared,
    // handing it out again could only produce a duplicate paper check.
    if (check.status !== "PRINTED") {
      const reason =
        check.status === "VOID"
          ? `Check #${check.checkNumber} is void, so its PDF can no longer be downloaded.`
          : check.status === "CLEARED"
            ? `Check #${check.checkNumber} has cleared the bank, so its PDF can no longer be downloaded.`
            : `Check #${check.checkNumber} has not been printed yet.`;
      throw new AppError(reason, 409, "CHECK_PDF_UNAVAILABLE");
    }

    if (!check.pdfStorageUrl || !check.pdfSha256) {
      throw new AppError(
        `No verifiable PDF is stored for check #${check.checkNumber}. Void the check and reissue it.`,
        410,
        "CHECK_PDF_MISSING",
      );
    }

    const buffer = await this.pdfService.readVerifiedPdf(check.pdfStorageUrl, check.pdfSha256);

    // Written before the bytes leave the server: no audit row, no download.
    await this.auditService.logOrRefuse({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_PDF_DOWNLOADED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber, pdfSha256: check.pdfSha256 },
      ipAddress: ctx.ipAddress,
    });

    return { buffer, checkNumber: check.checkNumber };
  }

  // ═════════════════════════════════════════════════════════════
  // PRINT OUTCOME: what came out of the printer
  //
  // OK       → the print is confirmed (who and when); the check stays PRINTED.
  // SPOILED  → the check is voided as SPOILED. The torn or smudged paper is
  //            destroyed and the check is REISSUED under a new number; the same
  //            number is never printed twice.
  //
  // Reported once, only while the check is PRINTED and unconfirmed. A print that
  // was confirmed OK and later turns out wrong is voided normally (void after print).
  // ═════════════════════════════════════════════════════════════

  async recordPrintOutcome(
    checkId: string,
    workspaceId: string,
    input: PrintOutcomeInput,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    if (check.status !== "PRINTED") {
      throw new ConflictError(
        check.status === "VOID"
          ? `Check #${check.checkNumber} is void, so its print outcome can no longer be reported.`
          : `Check #${check.checkNumber} has not been printed, so there is no print outcome to report.`,
      );
    }
    if (check.printConfirmedAt) {
      throw new ConflictError(
        `The print of check #${check.checkNumber} was already confirmed. If something is wrong with it, void the check.`,
      );
    }

    if (input.outcome === "OK") {
      const updated = await this.checkRepository.confirmPrint(checkId, workspaceId, ctx.userId);
      await this.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        workspaceId,
        action: "CHECK_PRINT_CONFIRMED",
        entityType: "Check",
        entityId: checkId,
        details: { checkNumber: check.checkNumber },
        ipAddress: ctx.ipAddress,
      });
      return { ...this.formatCheck(updated), notice: null };
    }

    const voidReason = `Spoiled during printing: ${input.reason}`;
    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "VOID",
      {
        checkId,
        fromStatus: "PRINTED",
        toStatus: "VOID",
        changedById: ctx.userId,
        reason: voidReason,
        ipAddress: ctx.ipAddress,
      },
      {
        voidReason,
        voidedAt: new Date(),
        voidedById: ctx.userId,
        voidType: "SPOILED",
      },
      // Not if someone confirmed it OK a moment ago.
      { printConfirmedAt: null },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_SPOILED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber, reason: input.reason },
      ipAddress: ctx.ipAddress,
    });

    return { ...this.formatCheck(updated), notice: spoiledNotice(check.checkNumber) };
  }

  // ═════════════════════════════════════════════════════════════
  // VOID CHECK
  //
  // Voiding is a permanent, irreversible action. The check
  // number is consumed forever. A voided check CANNOT be un-voided.
  //
  // Why require a reason? Auditors will ask: "Check #1042 was
  // voided — why?" The reason is stored in both the Check record
  // AND the StatusHistory for redundant audit trail.
  //
  // Transition: PRINTED → VOID
  // ═════════════════════════════════════════════════════════════

  async voidCheck(
    checkId: string,
    workspaceId: string,
    reason: string,
    ctx: AuditContext,
    access: { canVoidAnyCheck: boolean },
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "VOID");

    // Paper may exist once a check is printed, so only void permission can void it then.
    // Before printing, the creator may also withdraw their own check.
    const isPrinted = check.status === "PRINTED";
    if (!access.canVoidAnyCheck) {
      if (isPrinted) {
        throw new ForbiddenError("Only someone with void permission can void a printed check.");
      }
      if (check.createdById !== ctx.userId) {
        throw new ForbiddenError("You can only withdraw checks you created.");
      }
    }

    const voidType: VoidType = isPrinted ? "VOIDED_AFTER_PRINT" : "CANCELLED";

    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "VOID",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "VOID",
        changedById: ctx.userId,
        reason,
        ipAddress: ctx.ipAddress,
      },
      {
        voidReason: reason,
        voidedAt: new Date(),
        voidedById: ctx.userId,
        voidType,
      },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_VOIDED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        reason,
        fromStatus: check.status,
        voidType,
        stopPaymentAdvised: isPrinted,
      },
      ipAddress: ctx.ipAddress,
    });

    return {
      ...this.formatCheck(updated),
      // Voiding here does not stop a bank paying a check that left the office.
      notice: isPrinted ? stopPaymentNotice(check.checkNumber) : null,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // MARK AS CLEARED
  //
  // "Cleared" means the bank has processed the check and
  // deducted the money from the account. This is the happy-path
  // terminal state.
  //
  // clearedAmount may differ from the check amount in rare cases
  // (partial payments, bank adjustments). Recording both allows
  // reconciliation reporting.
  //
  // Transition: PRINTED → CLEARED
  // ═════════════════════════════════════════════════════════════

  async markAsCleared(
    checkId: string,
    workspaceId: string,
    input: ClearCheckInput,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "CLEARED");

    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "CLEARED",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "CLEARED",
        changedById: ctx.userId,
        ipAddress: ctx.ipAddress,
      },
      {
        clearedAt: new Date(),
        clearedById: ctx.userId,
        clearedDate: input.clearedDate ?? new Date(),
        clearedAmount: input.clearedAmount ?? Number(check.amount),
      },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_CLEARED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        amount: Number(check.amount),
        clearedAmount: input.clearedAmount ?? Number(check.amount),
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // REISSUE CHECK
  //
  // Creates a NEW check with a NEW check number, linked to the
  // original voided check via reissuedFromCheckId.
  //
  // Business rules:
  // - Only VOID checks can be reissued
  // - A voided check can only be reissued ONCE
  //   (checked via reissuedToCheck relation)
  // - The new check starts at NEW status and goes through
  //   the normal approval flow if required
  //
  // Why not just "un-void"? Because the original check number
  // is permanently consumed. The bank may have already recorded
  // it as void. Reusing the number would cause reconciliation
  // failures.
  // ═════════════════════════════════════════════════════════════

  async reissueCheck(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    if (check.status !== "VOID") {
      throw new ValidationError(
        "Only voided checks can be reissued",
        { status: ["Check must be in VOID status to reissue"] },
      );
    }

    if (check.reissuedToCheck) {
      throw new ConflictError(
        `This check has already been reissued as check #${check.reissuedToCheck.checkNumber}`,
      );
    }

    const settings = await this.settingsService.forWorkspace(workspaceId);
    const initialStatus = await this.determineInitialStatus(
      workspaceId,
      Number(check.amount),
      settings.approvalEnabled,
    );

    const newCheck = await this.checkRepository.createReissue(
      {
        workspaceId,
        bankAccountId: check.bankAccountId,
        payeeName: check.payeeName,
        amount: Number(check.amount),
        amountInWords: check.amountInWords,
        checkDate: new Date(),
        memo: check.memo,
        invoiceTableJson: check.invoiceTableJson,
        createdById: ctx.userId,
      },
      initialStatus,
      { id: check.id, checkNumber: check.checkNumber },
      ctx.userId,
      ctx.ipAddress,
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_REISSUED",
      entityType: "Check",
      entityId: newCheck.id,
      details: {
        newCheckNumber: newCheck.checkNumber,
        originalCheckId: checkId,
        originalCheckNumber: check.checkNumber,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(newCheck);
  }

  // ═════════════════════════════════════════════════════════════
  // SOFT DELETE
  //
  // Only NEW (draft) checks can be deleted. Once a check enters
  // any other state, it must be voided instead — the check
  // number is consumed and must be accounted for.
  //
  // Only the creator can delete their own drafts.
  // ═════════════════════════════════════════════════════════════

  async deleteCheck(
    checkId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    if (check.status !== "NEW") {
      throw new ValidationError(
        "Only draft checks can be deleted",
        { status: ["Check must be in NEW status to delete"] },
      );
    }

    if (check.createdById !== ctx.userId) {
      throw new ValidationError(
        "You can only delete checks you created",
        { authorization: ["Only the creator can delete this check"] },
      );
    }

    await this.checkRepository.softDeleteDraft(checkId, workspaceId, ctx.userId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_DELETED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber },
      ipAddress: ctx.ipAddress,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // PRIVATE: FIND MATCHING RULE
  //
  // Shared by approveCheck and rejectCheck. Finds the first
  // active rule (by priority) whose amount range covers the
  // check amount. Returns null if no rule matches.
  //
  // This is extracted because both approve and reject need
  // the same rule-matching logic, and duplicating it would
  // mean bugs could diverge between the two paths.
  // ═════════════════════════════════════════════════════════════

  // R-11: checks can only be written and printed from an active bank account.
  // "Inactive" (400) and "does not exist" (404) are different answers: an admin
  // can fix the first by reactivating the account.
  // The account's signature, decrypted from storage. A check from an account that has
  // a signature must never print unsigned by accident: if it cannot be loaded, the
  // print is refused.
  private async loadSignature(storageKey: string | null): Promise<Buffer | null> {
    if (!storageKey) return null;
    try {
      return await this.fileStorage.get(storageKey);
    } catch (err) {
      logger.error({ err, storageKey }, "Signature image could not be loaded for printing");
      throw new AppError(
        "The signature image for this bank account is missing or unreadable, so the check was not printed. Upload the signature again.",
        422,
        "SIGNATURE_IMAGE_UNAVAILABLE",
      );
    }
  }

  private async requireActiveBankAccount(bankAccountId: string, workspaceId: string, purpose: string) {
    const bankAccount = await this.checkRepository.findBankAccount(bankAccountId, workspaceId);
    if (!bankAccount) {
      throw new NotFoundError("Bank account");
    }
    if (!bankAccount.isActive) {
      throw new ValidationError(
        `The bank account ${bankAccount.bankName} ****${bankAccount.accountNumberLast4} is inactive, so you can't ${purpose}. An admin can reactivate it.`,
        { bankAccountId: ["Bank account is inactive"] },
      );
    }
    return bankAccount;
  }

  // Created with the defaults on first use, so a new workspace can write checks at once.
  private async requireSettings(workspaceId: string) {
    return this.settingsService.forWorkspace(workspaceId);
  }

  private assertAmountWithinLimit(amount: number, settings: { maxCheckAmount: unknown }) {
    const max = Number(settings.maxCheckAmount);
    if (amount > max) {
      const formatted = max.toLocaleString("en-US", { minimumFractionDigits: 2 });
      throw new ValidationError(`Amount exceeds maximum of $${formatted}`, {
        amount: [`Maximum check amount is $${formatted}`],
      });
    }
  }

  private assertDateWithinRange(
    checkDate: Date,
    settings: { maxPastDays: number; maxFutureDays: number },
  ) {
    const dateCheck = validateCheckDateRange(
      checkDate,
      settings.maxPastDays,
      settings.maxFutureDays,
    );
    if (!dateCheck.valid) {
      throw new ValidationError(dateCheck.error!, { checkDate: [dateCheck.error!] });
    }
  }

  // Fast, friendly rejection. recordDecision's unique index is the real guarantee.
  private async assertNotYetDecided(
    check: { id: string; approvalRound: number },
    userId: string,
  ) {
    if (await this.checkRepository.hasUserDecided(check.id, check.approvalRound, userId)) {
      throw new ConflictError("You have already submitted a decision on this check");
    }
  }

  // ═════════════════════════════════════════════════════════════
  // PRIVATE: DOES THIS CHECK NEED APPROVAL BEFORE PRINTING? (R-03)
  //
  // Approval is needed only when the workflow is ON and an active rule matches the amount.
  // An APPROVED check has it; a draft (NEW) that needs none prints directly, so a one-person
  // business can create and print. Decided now, at print time, not when the draft was made:
  // approval switched on later, or an amount edited above a threshold, still requires it.
  // The result is recorded on the CHECK_PRINTED audit entry.
  // ═════════════════════════════════════════════════════════════

  private async approvalForPrint(check: { status: CheckStatus; workspaceId: string; amount: unknown; checkNumber: number }) {
    if (check.status === "APPROVED") return { required: true, reason: "APPROVED" } as const;

    const settings = await this.settingsService.forWorkspace(check.workspaceId);
    if (!settings.approvalEnabled) return { required: false, reason: "APPROVAL_WORKFLOW_OFF" } as const;

    const rule = await this.findMatchingRule(check.workspaceId, Number(check.amount));
    if (!rule) return { required: false, reason: "NO_MATCHING_RULE" } as const;

    throw new AppError(
      `Check #${check.checkNumber} needs approval before it can be printed (approval rule for ` +
        `${ruleLabel(rule.minAmount, rule.maxAmount)}). Submit it for approval first.`,
      409,
      "APPROVAL_REQUIRED",
    );
  }

  private async findMatchingRule(workspaceId: string, amount: number) {
    const rules = await this.checkRepository.findApprovalRules(workspaceId);

    return rules.find((rule) => {
      const min = rule.minAmount ? Number(rule.minAmount) : 0;
      const max = rule.maxAmount ? Number(rule.maxAmount) : Infinity;
      return amount >= min && amount <= max;
    }) ?? null;
  }

  // ═════════════════════════════════════════════════════════════
  // PRIVATE: ENFORCE APPROVER ACCESS
  //
  // Two checks in sequence:
  //
  // 1. DESIGNATED APPROVER — if the rule has designated
  //    approvers, the user must be one of them. If the rule
  //    has no designated approvers (empty list), anyone with
  //    check:approve permission is allowed (open approval).
  //
  // 2. SEPARATION OF DUTIES — if creator === approver:
  //    - If rule exists and allowSelfApproval is true → allow
  //    - Otherwise → block
  //
  // Why this order? A designated-approver check is cheaper
  // (array lookup) and catches most unauthorized attempts.
  // The self-approval check only matters for the creator.
  // ═════════════════════════════════════════════════════════════

  private enforceApproverAccess(
    matchedRule: { approvers: { userId: string }[]; allowSelfApproval: boolean } | null,
    createdById: string,
    approverId: string,
  ) {
    if (matchedRule && matchedRule.approvers.length > 0) {
      const isDesignated = matchedRule.approvers.some(
        (a) => a.userId === approverId,
      );
      if (!isDesignated) {
        throw new ValidationError(
          "You are not a designated approver for this check's approval rule",
          { authorization: ["Only designated approvers can approve/reject this check"] },
        );
      }
    }

    if (createdById === approverId) {
      const selfAllowed = matchedRule?.allowSelfApproval ?? false;
      if (!selfAllowed) {
        throw new ValidationError(
          "You cannot approve or reject a check you created",
          { authorization: ["Separation of duties: creator cannot be the approver"] },
        );
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // PRIVATE: DETERMINE INITIAL STATUS
  //
  // This is the decision engine for the approval workflow.
  //
  // Logic:
  // 1. If approvalEnabled is false → always NEW (skip all rules)
  // 2. If approvalEnabled is true → check ApprovalWorkflowRules
  // 3. Rules are sorted by priority (ascending)
  // 4. First rule where amount is in [minAmount, maxAmount] wins
  // 5. If a matching rule is found → PENDING_APPROVAL
  // 6. If no rules match → NEW (below all thresholds)
  //
  // Why check `approvalEnabled` first?
  // This is the "master switch." An admin might have rules
  // configured but temporarily disabled (e.g., during a demo,
  // or when the sole approver is on vacation). Without this
  // switch, they'd have to delete and recreate all rules.
  // ═════════════════════════════════════════════════════════════

  private async determineInitialStatus(
    workspaceId: string,
    amount: number,
    approvalEnabled: boolean,
  ): Promise<CheckStatus> {
    if (!approvalEnabled) {
      return "NEW";
    }

    const rules = await this.checkRepository.findApprovalRules(workspaceId);
    if (rules.length === 0) {
      return "NEW";
    }

    const matchingRule = rules.find((rule) => {
      const min = rule.minAmount ? Number(rule.minAmount) : 0;
      const max = rule.maxAmount ? Number(rule.maxAmount) : Infinity;
      return amount >= min && amount <= max;
    });

    return matchingRule ? "PENDING_APPROVAL" : "NEW";
  }

  // ═════════════════════════════════════════════════════════════
  // PRIVATE: FORMAT CHECK (single)
  //
  // Transforms raw Prisma data into the API response shape.
  // This is where database field names are mapped to client-
  // friendly names (e.g., invoiceTableJson → invoiceItems).
  //
  // AUDIT POINT ADDRESSED: Old code concatenated
  // `firstName + lastName`. User model has `fullName` only.
  // ═════════════════════════════════════════════════════════════

  private formatCheck(check: any) {
    return {
      id: check.id,
      checkNumber: check.checkNumber,
      status: check.status,
      payeeName: check.payeeName,
      amount: Number(check.amount).toFixed(2),
      amountInWords: check.amountInWords,
      checkDate: check.checkDate,
      memo: check.memo,
      invoiceItems: check.invoiceTableJson,
      // Never expose the storage location; clients download through /pdf.
      hasPdf: Boolean(check.pdfStorageUrl),
      voidReason: check.voidReason,
      voidType: check.voidType ?? null,
      voidedAt: check.voidedAt,
      printedAt: check.printedAt,
      printConfirmedAt: check.printConfirmedAt ?? null,
      printConfirmedBy: check.printConfirmedBy
        ? { id: check.printConfirmedBy.id, fullName: check.printConfirmedBy.fullName }
        : null,
      printSnapshot: check.printedAt
        ? {
            calibrationProfileId: check.calibrationProfileId,
            paperSize: check.printPaperSize,
            layout: check.printLayout ?? null,
            position: check.printPosition ?? null,
            horizontalOffsetPts: check.printOffsetXPts === null ? null : Number(check.printOffsetXPts).toFixed(2),
            verticalOffsetPts: check.printOffsetYPts === null ? null : Number(check.printOffsetYPts).toFixed(2),
          }
        : null,
      clearedAt: check.clearedAt,
      clearedDate: check.clearedDate,
      clearedAmount: check.clearedAmount
        ? Number(check.clearedAmount).toFixed(2)
        : null,

      createdBy: {
        id: check.createdBy.id,
        fullName: check.createdBy.fullName,
      },
      printedBy: check.printedBy
        ? { id: check.printedBy.id, fullName: check.printedBy.fullName }
        : null,
      voidedBy: check.voidedBy
        ? { id: check.voidedBy.id, fullName: check.voidedBy.fullName }
        : null,
      clearedBy: check.clearedBy
        ? { id: check.clearedBy.id, fullName: check.clearedBy.fullName }
        : null,

      bankAccount: {
        id: check.bankAccount.id,
        bankName: check.bankAccount.bankName,
        accountNumber: `****${check.bankAccount.accountNumberLast4}`,
        accountType: check.bankAccount.accountType,
      },

      reissuedFromCheckId: check.reissuedFromCheckId,
      reissuedFrom: check.reissuedFromCheck
        ? { id: check.reissuedFromCheck.id, checkNumber: check.reissuedFromCheck.checkNumber }
        : null,
      reissuedTo: check.reissuedToCheck
        ? { id: check.reissuedToCheck.id, checkNumber: check.reissuedToCheck.checkNumber }
        : null,

      statusHistory: check.statusHistory?.map((h: any) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: { id: h.changedBy.id, fullName: h.changedBy.fullName },
        reason: h.reason,
        createdAt: h.createdAt,
      })) ?? [],

      attachments: (check.attachments ?? []).map(formatAttachment),

      approval: this.formatApprovalProgress(check),

      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
    };
  }

  private formatApprovalProgress(check: any) {
    const records = check.approvalRecords ?? [];

    if (records.length === 0) return null;

    // Progress counts only the current round; earlier rounds stay visible as history.
    const round: number = check.approvalRound ?? 1;
    const currentRound = records.filter((r: any) => r.round === round);
    const approvedCount = currentRound.filter((r: any) => r.decision === "approved").length;
    const requiredApprovals: number | null = currentRound[0]?.rule?.requiredApprovals ?? null;

    return {
      round,
      requiredApprovals,
      approvedCount,
      isFullyApproved: requiredApprovals !== null && approvedCount >= requiredApprovals,
      decisions: records.map((r: any) => ({
        id: r.id,
        round: r.round,
        decision: r.decision,
        reason: r.reason,
        approver: {
          id: r.approver.id,
          fullName: r.approver.fullName,
        },
        createdAt: r.createdAt,
      })),
    };
  }

  private formatCheckListItem(check: any) {
    return {
      id: check.id,
      checkNumber: check.checkNumber,
      status: check.status,
      payeeName: check.payeeName,
      amount: Number(check.amount).toFixed(2),
      checkDate: check.checkDate,
      memo: check.memo,
      createdBy: {
        id: check.createdBy.id,
        fullName: check.createdBy.fullName,
      },
      bankAccount: {
        id: check.bankAccount.id,
        bankName: check.bankAccount.bankName,
        accountNumber: `****${check.bankAccount.accountNumberLast4}`,
        accountType: check.bankAccount.accountType,
      },
      createdAt: check.createdAt,
    };
  }
}
