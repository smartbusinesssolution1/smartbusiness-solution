import { CheckRepository } from "./check.repository.js";
import { AuditService } from "../../shared/services/audit.service.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/index.js";
import {
  assertTransition,
  amountToWords,
  validateCheckDateRange,
} from "./check.helpers.js";
import type {
  CreateCheckInput,
  UpdateCheckInput,
  ClearCheckInput,
  ListChecksQuery,
  PrintCheckInput,
} from "./check.schemas.js";
import type { AuditContext } from "./check.types.js";
import type { PdfService } from "../pdf/pdf.service.js";
import type { CalibrationService } from "../calibration/calibration.service.js";
import type { EncryptionService } from "../../shared/services/encryption.service.js";
import { templateForPrinter } from "../pdf/pdf.templates.js";
import { assertMicrPrintable } from "../../shared/utils/micr-validation.js";
import type { CheckPdfData } from "../pdf/pdf.types.js";

export class CheckService {
  constructor(
    private checkRepository: CheckRepository,
    private auditService: AuditService,
    private pdfService: PdfService,
    private calibrationService: CalibrationService,
    private encryptionService: EncryptionService,
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
    const bankAccount = await this.checkRepository.findBankAccount(
      input.bankAccountId,
      workspaceId,
    );
    if (!bankAccount) {
      throw new NotFoundError("Bank account");
    }

    const settings = await this.checkRepository.findCheckPrintingSettings(workspaceId);
    if (!settings) {
      throw new ValidationError("Workspace check printing settings not configured", {
        workspace: ["Please configure check printing settings first"],
      });
    }

    if (input.amount > Number(settings.maxCheckAmount)) {
      throw new ValidationError(
        `Amount exceeds maximum of $${Number(settings.maxCheckAmount).toLocaleString()}`,
        { amount: [`Maximum check amount is $${Number(settings.maxCheckAmount).toLocaleString()}`] },
      );
    }

    const dateCheck = validateCheckDateRange(
      input.checkDate,
      settings.maxPastDays,
      settings.maxFutureDays,
    );
    if (!dateCheck.valid) {
      throw new ValidationError(dateCheck.error!, {
        checkDate: [dateCheck.error!],
      });
    }

    const words = amountToWords(input.amount);

    const initialStatus = await this.determineInitialStatus(
      workspaceId,
      input.amount,
      settings.approvalEnabled,
    );

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
        bankAccountId: input.bankAccountId,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(check);
  }

  // ═════════════════════════════════════════════════════════════
  // GET SINGLE CHECK
  // ═════════════════════════════════════════════════════════════

  async getCheck(checkId: string, workspaceId: string) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }
    return this.formatCheck(check);
  }

  // ═════════════════════════════════════════════════════════════
  // LIST CHECKS
  // ═════════════════════════════════════════════════════════════

  async listChecks(workspaceId: string, query: ListChecksQuery) {
    const { items, total } = await this.checkRepository.list({
      workspaceId,
      ...query,
    });

    const totalPages = Math.ceil(total / query.limit);

    return {
      items: items.map((item: any) => this.formatCheckListItem(item)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasMore: query.page < totalPages,
      },
    };
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
    const alreadyVotedOn = new Set(userDecisions.map((d) => d.checkId));

    const filtered = allPending.filter((check: any) => {
      if (alreadyVotedOn.has(check.id)) return false;

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

    if (check.status !== "NEW" && check.status !== "REJECTED") {
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

    const updateData: Record<string, unknown> = {};

    if (input.payeeName !== undefined) {
      updateData.payeeName = input.payeeName;
    }

    if (input.amount !== undefined) {
      const settings = await this.checkRepository.findCheckPrintingSettings(workspaceId);
      if (settings && input.amount > Number(settings.maxCheckAmount)) {
        throw new ValidationError(
          `Amount exceeds maximum of $${Number(settings.maxCheckAmount).toLocaleString()}`,
          { amount: [`Maximum check amount is $${Number(settings.maxCheckAmount).toLocaleString()}`] },
        );
      }
      updateData.amount = input.amount;
      updateData.amountInWords = amountToWords(input.amount);
    }

    if (input.checkDate !== undefined) {
      const settings = await this.checkRepository.findCheckPrintingSettings(workspaceId);
      if (settings) {
        const dateCheck = validateCheckDateRange(
          input.checkDate,
          settings.maxPastDays,
          settings.maxFutureDays,
        );
        if (!dateCheck.valid) {
          throw new ValidationError(dateCheck.error!, { checkDate: [dateCheck.error!] });
        }
      }
      updateData.checkDate = input.checkDate;
    }

    if (input.memo !== undefined) {
      updateData.memo = input.memo;
    }

    if (input.invoiceItems !== undefined) {
      updateData.invoiceTableJson = input.invoiceItems;
    }

    const updated = await this.checkRepository.updateData(
      checkId,
      workspaceId,
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

    return this.formatCheck(updated);
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

    const existingDecision = await this.checkRepository.hasUserDecided(checkId, ctx.userId);
    if (existingDecision) {
      throw new ConflictError(
        "You have already submitted a decision on this check",
      );
    }

    if (matchedRule) {
      await this.checkRepository.createApprovalRecord({
        checkId,
        ruleId: matchedRule.id,
        approverId: ctx.userId,
        decision: "approved",
      });

      const approvedCount = await this.checkRepository.countApprovedRecords(
        checkId,
        matchedRule.id,
      );

      if (approvedCount < matchedRule.requiredApprovals) {
        await this.auditService.log({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          workspaceId,
          action: "CHECK_APPROVAL_RECORDED",
          entityType: "Check",
          entityId: checkId,
          details: {
            checkNumber: check.checkNumber,
            ruleId: matchedRule.id,
            approvedCount,
            requiredApprovals: matchedRule.requiredApprovals,
          },
          ipAddress: ctx.ipAddress,
        });

        const current = await this.checkRepository.findById(checkId, workspaceId);
        return this.formatCheck(current!);
      }
    }

    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "APPROVED",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "APPROVED",
        changedById: ctx.userId,
        ipAddress: ctx.ipAddress,
      },
    );

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
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
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

    const existingDecision = await this.checkRepository.hasUserDecided(checkId, ctx.userId);
    if (existingDecision) {
      throw new ConflictError(
        "You have already submitted a decision on this check",
      );
    }

    if (matchedRule) {
      await this.checkRepository.createApprovalRecord({
        checkId,
        ruleId: matchedRule.id,
        approverId: ctx.userId,
        decision: "rejected",
        reason,
      });
    }

    const updated = await this.checkRepository.updateStatus(
      checkId,
      workspaceId,
      "REJECTED",
      {
        checkId,
        fromStatus: check.status,
        toStatus: "REJECTED",
        changedById: ctx.userId,
        reason,
        ipAddress: ctx.ipAddress,
      },
    );

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
      action: "CHECK_RESUBMITTED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber },
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
  // 1. Load check and validate transition
  // 2. Load bank account (for MICR: routing, account numbers)
  // 3. Decrypt sensitive bank data
  // 4. Load workspace (for company header on check face)
  // 5. Resolve the printer profile (chosen, else workspace default):
  //    paper size + calibration offsets
  // 6. Build CheckPdfData and generate PDF via PdfService
  // 7. Update check status to PRINTED with PDF path and print snapshot
  // 8. Audit log
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

    const bankAccount = await this.checkRepository.findBankAccount(
      check.bankAccountId,
      workspaceId,
    );
    if (!bankAccount) {
      throw new NotFoundError("Bank account");
    }

    const routingNumber = this.encryptionService.decrypt(
      bankAccount.routingNumberEncrypted,
    );
    const accountNumber = this.encryptionService.decrypt(
      bankAccount.accountNumberEncrypted,
    );

    const workspace = await this.checkRepository.findWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    const printer = await this.calibrationService.resolveForPrint(
      workspaceId,
      input.calibrationProfileId,
    );

    const paddedCheckNumber = String(check.checkNumber).padStart(
      bankAccount.checkNumberPadding ?? 6,
      "0",
    );

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

    const pdfData: CheckPdfData = {
      checkNumber: paddedCheckNumber,
      payeeName: check.payeeName,
      amount: formattedAmount,
      amountInWords: check.amountInWords,
      checkDate: formattedDate,
      memo: check.memo,
      routingNumber,
      accountNumber,
      bankName: bankAccount.bankName,
      checkNumberPadding: bankAccount.checkNumberPadding ?? 6,
      companyName: workspace.businessName,
      companyAddress,
      companyCityStateZip,
      horizontalOffsetPts: printer.horizontalOffsetPts,
      verticalOffsetPts: printer.verticalOffsetPts,
      signatureImagePath: bankAccount.signatureImageUrl ?? null,
      template: templateForPrinter(printer),
      invoiceItems: check.invoiceTableJson as
        Array<{ description: string; amount: string }> | null,
    };

    const pdfStorageUrl = await this.pdfService.generateCheckPdf(
      pdfData,
      workspaceId,
      checkId,
    );

    const updated = await this.checkRepository.updateStatus(
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
      {
        printedAt: new Date(),
        printedById: ctx.userId,
        pdfStorageUrl,
        calibrationProfileId: printer.profileId,
        printOffsetXPts: printer.horizontalOffsetPts,
        printOffsetYPts: printer.verticalOffsetPts,
        printPaperSize: printer.paperSize,
      },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_PRINTED",
      entityType: "Check",
      entityId: checkId,
      details: {
        checkNumber: check.checkNumber,
        pdfStorageUrl,
        printer: {
          profileId: printer.profileId,
          profileName: printer.profileName,
          paperSize: printer.paperSize,
          horizontalOffsetPts: printer.horizontalOffsetPts,
          verticalOffsetPts: printer.verticalOffsetPts,
        },
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // GET PDF BUFFER (for download endpoint)
  // ═════════════════════════════════════════════════════════════

  async getCheckPdfBuffer(
    checkId: string,
    workspaceId: string,
  ): Promise<{ buffer: Buffer; checkNumber: number }> {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    if (!check.pdfStorageUrl) {
      throw new NotFoundError("PDF not found. The check may not have been printed yet");
    }

    const buffer = await this.pdfService.getPdfBuffer(check.pdfStorageUrl);
    return { buffer, checkNumber: check.checkNumber };
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
  ) {
    const check = await this.checkRepository.findById(checkId, workspaceId);
    if (!check) {
      throw new NotFoundError("Check");
    }

    assertTransition(check.status, "VOID");

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
      },
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_VOIDED",
      entityType: "Check",
      entityId: checkId,
      details: { checkNumber: check.checkNumber, reason },
      ipAddress: ctx.ipAddress,
    });

    return this.formatCheck(updated);
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

    if ((check as any).reissuedToCheck) {
      throw new ConflictError("This check has already been reissued");
    }

    const settings = await this.checkRepository.findCheckPrintingSettings(workspaceId);
    const initialStatus = await this.determineInitialStatus(
      workspaceId,
      Number(check.amount),
      settings?.approvalEnabled ?? false,
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
      checkId,
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

    await this.checkRepository.softDelete(checkId, workspaceId);

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
  ): Promise<string> {
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
      pdfStorageUrl: check.pdfStorageUrl,
      voidReason: check.voidReason,
      voidedAt: check.voidedAt,
      printedAt: check.printedAt,
      printSnapshot: check.printedAt
        ? {
            calibrationProfileId: check.calibrationProfileId,
            paperSize: check.printPaperSize,
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

      statusHistory: check.statusHistory?.map((h: any) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: { id: h.changedBy.id, fullName: h.changedBy.fullName },
        reason: h.reason,
        createdAt: h.createdAt,
      })) ?? [],

      approval: this.formatApprovalProgress(check),

      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
    };
  }

  private formatApprovalProgress(check: any) {
    const records = check.approvalRecords ?? [];

    if (records.length === 0) return null;

    const approvedCount = records.filter(
      (r: any) => r.decision === "approved",
    ).length;

    const requiredApprovals = records[0]?.rule?.requiredApprovals ?? 1;

    return {
      requiredApprovals,
      approvedCount,
      isFullyApproved: approvedCount >= requiredApprovals,
      decisions: records.map((r: any) => ({
        id: r.id,
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
