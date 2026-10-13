import { ApprovalRuleRepository } from "./approval-rule.repository.js";
import { AuditService } from "../../shared/services/audit.service.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/index.js";
import type {
  CreateApprovalRuleInput,
  UpdateApprovalRuleInput,
} from "./approval-rule.schemas.js";
import type {
  ApprovalRuleResponse,
  ApprovalRuleListResponse,
  ApproverResponse,
  EligibleApproverResponse,
  AuditContext,
} from "./approval-rule.types.js";

// ═══════════════════════════════════════════════════════════════
// APPROVAL RULE SERVICE
//
// Business logic for approval workflow rules. This is a CRUD
// service with these business rules:
//
// 1. Duplicate prevention — no two rules with the same
//    minAmount AND maxAmount in the same workspace
// 2. FK-safe deletion — can't delete a rule that has been
//    used in approval decisions (ApprovalRecord references it)
// 3. Audit logging — every mutation is recorded
// 4. Master switch surfacing — list response includes
//    approvalEnabled status from CheckPrintingSettings
//
// DESIGN: This service MANAGES rules (CRUD). The Check module
// CONSUMES rules (reads them in determineInitialStatus).
// They share a database table, not code.
//
// CONSTRUCTOR INJECTION: Same pattern as CheckService and
// BankAccountService. The service receives its dependencies
// through the constructor, not through imports. This makes
// testing easier — you can pass a mock repository.
// ═══════════════════════════════════════════════════════════════

export class ApprovalRuleService {
  constructor(
    private repository: ApprovalRuleRepository,
    private auditService: AuditService,
  ) {}

  // ─── CREATE RULE ─────────────────────────────────────────
  //
  // Steps:
  // 1. Check for duplicate (same minAmount + maxAmount)
  // 2. Create the rule
  // 3. Audit log
  // 4. Return formatted response
  // ═════════════════════════════════════════════════════════

  async createRule(
    workspaceId: string,
    input: CreateApprovalRuleInput,
    ctx: AuditContext,
  ): Promise<ApprovalRuleResponse> {
    const duplicate = await this.repository.findDuplicate(
      workspaceId,
      input.minAmount,
      input.maxAmount,
    );

    if (duplicate) {
      throw new ConflictError(
        `An approval rule with this amount range already exists`,
      );
    }

    const rule = await this.repository.create({
      workspaceId,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      priority: input.priority,
      requiredApprovals: input.requiredApprovals,
      allowSelfApproval: input.allowSelfApproval,
      createdById: ctx.userId,
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVAL_RULE_CREATED",
      entityType: "ApprovalRule",
      entityId: rule.id,
      details: {
        minAmount: input.minAmount,
        maxAmount: input.maxAmount ?? null,
        priority: input.priority ?? 1,
        requiredApprovals: input.requiredApprovals ?? 1,
        allowSelfApproval: input.allowSelfApproval ?? false,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatRule(rule);
  }

  // ─── GET SINGLE RULE ─────────────────────────────────────

  async getRule(
    ruleId: string,
    workspaceId: string,
  ): Promise<ApprovalRuleResponse> {
    const rule = await this.findRuleOrThrow(ruleId, workspaceId);
    return this.formatRule(rule);
  }

  // ─── LIST RULES ──────────────────────────────────────────
  //
  // Returns rules plus the approvalEnabled master switch
  // status in the meta. The frontend needs both to render
  // the settings page correctly:
  //
  // - Rules exist + approvalEnabled = true → "Active"
  // - Rules exist + approvalEnabled = false → "Rules exist
  //   but approval is disabled"
  // - No rules → "No approval rules configured"
  // ═════════════════════════════════════════════════════════

  async listRules(
    workspaceId: string,
    includeInactive: boolean = false,
  ): Promise<ApprovalRuleListResponse> {
    const [{ items, total }, settings] = await Promise.all([
      this.repository.list(workspaceId, includeInactive),
      this.repository.findSettings(workspaceId),
    ]);

    return {
      items: items.map((rule) => this.formatRule(rule)),
      meta: {
        total,
        approvalEnabled: settings?.approvalEnabled ?? false,
      },
    };
  }

  // ─── UPDATE RULE ─────────────────────────────────────────
  //
  // Only updates fields that are provided in the input.
  // The Zod schema makes all fields optional for update,
  // so the admin can change just the priority without
  // touching the amount.
  //
  // If minAmount changes, we check for duplicates again
  // (excluding the current rule from the duplicate search).
  // ═════════════════════════════════════════════════════════

  async updateRule(
    ruleId: string,
    workspaceId: string,
    input: UpdateApprovalRuleInput,
    ctx: AuditContext,
  ): Promise<ApprovalRuleResponse> {
    const existing = await this.findRuleOrThrow(ruleId, workspaceId);

    const newMin = input.minAmount ?? Number(existing.minAmount);
    const newMax = input.maxAmount !== undefined
      ? input.maxAmount
      : (existing.maxAmount ? Number(existing.maxAmount) : null);

    if (newMax !== null && newMax !== undefined && newMax <= newMin) {
      throw new ValidationError(
        "Maximum amount must be greater than minimum amount",
        { maxAmount: ["Must be greater than minimum amount"] },
      );
    }

    if (input.minAmount !== undefined || input.maxAmount !== undefined) {
      const duplicate = await this.repository.findDuplicate(
        workspaceId,
        newMin,
        newMax,
        ruleId,
      );

      if (duplicate) {
        throw new ConflictError(
          `Another approval rule with this amount range already exists`,
        );
      }
    }

    const updateData: {
      minAmount?: number;
      maxAmount?: number | null;
      priority?: number;
      requiredApprovals?: number;
      allowSelfApproval?: boolean;
    } = {};
    if (input.minAmount !== undefined) updateData.minAmount = input.minAmount;
    if (input.maxAmount !== undefined) updateData.maxAmount = input.maxAmount;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.requiredApprovals !== undefined) updateData.requiredApprovals = input.requiredApprovals;
    if (input.allowSelfApproval !== undefined) updateData.allowSelfApproval = input.allowSelfApproval;

    const updated = await this.repository.update(ruleId, updateData);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVAL_RULE_UPDATED",
      entityType: "ApprovalRule",
      entityId: ruleId,
      details: {
        changes: input,
        previousMinAmount: existing.minAmount?.toString(),
        previousMaxAmount: existing.maxAmount?.toString() ?? null,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatRule(updated);
  }

  // ─── ACTIVATE RULE ───────────────────────────────────────

  async activateRule(
    ruleId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<ApprovalRuleResponse> {
    const rule = await this.findRuleOrThrow(ruleId, workspaceId);

    if (rule.isActive) {
      throw new ValidationError("This rule is already active");
    }

    const updated = await this.repository.setActive(ruleId, true);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVAL_RULE_ACTIVATED",
      entityType: "ApprovalRule",
      entityId: ruleId,
      details: { minAmount: rule.minAmount?.toString() },
      ipAddress: ctx.ipAddress,
    });

    return this.formatRule(updated);
  }

  // ─── DEACTIVATE RULE ─────────────────────────────────────

  async deactivateRule(
    ruleId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<ApprovalRuleResponse> {
    const rule = await this.findRuleOrThrow(ruleId, workspaceId);

    if (!rule.isActive) {
      throw new ValidationError("This rule is already inactive");
    }

    const updated = await this.repository.setActive(ruleId, false);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVAL_RULE_DEACTIVATED",
      entityType: "ApprovalRule",
      entityId: ruleId,
      details: { minAmount: rule.minAmount?.toString() },
      ipAddress: ctx.ipAddress,
    });

    return this.formatRule(updated);
  }

  // ─── DELETE RULE ─────────────────────────────────────────
  //
  // Before deleting, check if any ApprovalRecord references
  // this rule. ApprovalRecord has:
  //   ruleId String @map("rule_id")
  //   rule ApprovalWorkflowRule @relation(...)
  //
  // If records exist, PostgreSQL would throw a FK violation.
  // We check first to give a clean, actionable error message
  // instead of a cryptic P2003 database error.
  //
  // WHY NOT SOFT DELETE?
  // For MVP, hard delete is acceptable because:
  // 1. The audit log preserves the deletion event
  // 2. The ApprovalRecords themselves are immutable and
  //    record which rule was used (by ruleId)
  // 3. We block deletion when records reference the rule,
  //    so no audit trail is lost
  //
  // If we CANNOT delete (records exist), the admin must
  // deactivate instead. Deactivated rules stop matching new
  // checks but preserve the FK relationship for existing
  // approval records.
  // ═════════════════════════════════════════════════════════

  async deleteRule(
    ruleId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<void> {
    const rule = await this.findRuleOrThrow(ruleId, workspaceId);

    const hasRecords = await this.repository.hasApprovalRecords(ruleId);
    if (hasRecords) {
      throw new ConflictError(
        "This rule has been used in approval decisions and cannot be deleted. Deactivate it instead.",
      );
    }

    await this.repository.delete(ruleId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVAL_RULE_DELETED",
      entityType: "ApprovalRule",
      entityId: ruleId,
      details: {
        minAmount: rule.minAmount?.toString(),
        maxAmount: rule.maxAmount?.toString() ?? null,
        wasActive: rule.isActive,
      },
      ipAddress: ctx.ipAddress,
    });
  }

  // ─── TOGGLE APPROVAL ENABLED ─────────────────────────────
  //
  // Controls the master switch on CheckPrintingSettings.
  // The Check module checks this FIRST in determineInitialStatus:
  //   if (!approvalEnabled) return "NEW";
  //
  // If approvalEnabled is false, no rules take effect
  // regardless of how many are configured. This gives the
  // admin an easy way to temporarily disable the entire
  // approval workflow without deleting/deactivating rules.
  // ═════════════════════════════════════════════════════════

  async setApprovalEnabled(
    workspaceId: string,
    enabled: boolean,
    ctx: AuditContext,
  ): Promise<{ approvalEnabled: boolean }> {
    const settings = await this.repository.findSettings(workspaceId);
    if (!settings) {
      throw new ValidationError("Workspace check printing settings not configured", {
        workspace: ["Please configure check printing settings first"],
      });
    }

    await this.repository.setApprovalEnabled(workspaceId, enabled);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: enabled ? "APPROVAL_WORKFLOW_ENABLED" : "APPROVAL_WORKFLOW_DISABLED",
      entityType: "CheckPrintingSettings",
      entityId: workspaceId,
      details: { approvalEnabled: enabled },
      ipAddress: ctx.ipAddress,
    });

    return { approvalEnabled: enabled };
  }

  // ═══════════════════════════════════════════════════════════
  // APPROVER MANAGEMENT
  //
  // Designated approvers are workspace members assigned to a
  // specific rule. When a check matches a rule with designated
  // approvers, only those users can approve it.
  //
  // If a rule has NO designated approvers, any workspace member
  // with check:approve permission can approve (open approval).
  // ═══════════════════════════════════════════════════════════

  async listApprovers(
    ruleId: string,
    workspaceId: string,
  ): Promise<ApproverResponse[]> {
    await this.findRuleOrThrow(ruleId, workspaceId);
    const approvers = await this.repository.listApprovers(ruleId);
    return approvers.map((a) => this.formatApprover(a));
  }

  async addApprover(
    ruleId: string,
    workspaceId: string,
    userId: string,
    ctx: AuditContext,
  ): Promise<ApproverResponse> {
    await this.findRuleOrThrow(ruleId, workspaceId);
    await this.validateApproverEligibility(workspaceId, userId);

    const existing = await this.repository.findApprover(ruleId, userId);
    if (existing) {
      throw new ConflictError("This user is already a designated approver for this rule");
    }

    const approver = await this.repository.addApprover(ruleId, userId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVER_ADDED",
      entityType: "ApprovalWorkflowApprover",
      entityId: approver.id,
      details: { ruleId, approverUserId: userId },
      ipAddress: ctx.ipAddress,
    });

    return this.formatApprover(approver);
  }

  async removeApprover(
    ruleId: string,
    workspaceId: string,
    userId: string,
    ctx: AuditContext,
  ): Promise<void> {
    await this.findRuleOrThrow(ruleId, workspaceId);

    const existing = await this.repository.findApprover(ruleId, userId);
    if (!existing) {
      throw new NotFoundError("Approver assignment");
    }

    await this.repository.removeApprover(ruleId, userId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVER_REMOVED",
      entityType: "ApprovalWorkflowApprover",
      entityId: existing.id,
      details: { ruleId, approverUserId: userId },
      ipAddress: ctx.ipAddress,
    });
  }

  // Replaces ALL designated approvers for a rule in one operation.
  // Validates every userId before writing anything.
  async syncApprovers(
    ruleId: string,
    workspaceId: string,
    userIds: string[],
    ctx: AuditContext,
  ): Promise<ApproverResponse[]> {
    await this.findRuleOrThrow(ruleId, workspaceId);

    const uniqueIds = [...new Set(userIds)];

    for (const userId of uniqueIds) {
      await this.validateApproverEligibility(workspaceId, userId);
    }

    const approvers = await this.repository.syncApprovers(ruleId, uniqueIds);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "APPROVERS_SYNCED",
      entityType: "ApprovalWorkflowRule",
      entityId: ruleId,
      details: { approverCount: uniqueIds.length, approverUserIds: uniqueIds },
      ipAddress: ctx.ipAddress,
    });

    return approvers.map((a) => this.formatApprover(a));
  }

  async listEligibleApprovers(
    workspaceId: string,
  ): Promise<EligibleApproverResponse[]> {
    const members = await this.repository.findEligibleApprovers(workspaceId);

    return members.map((m) => ({
      userId: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      roles: m.assignedRoles.map((r) => r.role.name),
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  // ─── Find Rule or Throw ──────────────────────────────────
  //
  // Combines two operations that every mutation needs:
  // 1. Fetch the rule by ID
  // 2. Verify it belongs to this workspace (IDOR prevention)
  //
  // Without this helper, every method would repeat:
  //   const rule = await this.repository.findById(ruleId);
  //   if (!rule || rule.workspaceId !== workspaceId) {
  //     throw new NotFoundError("Approval rule");
  //   }
  //
  // The helper eliminates that duplication.
  // ═════════════════════════════════════════════════════════

  private async findRuleOrThrow(ruleId: string, workspaceId: string) {
    const rule = await this.repository.findById(ruleId);

    if (!rule || rule.workspaceId !== workspaceId) {
      throw new NotFoundError("Approval rule");
    }

    return rule;
  }

  // ─── Format Rule ─────────────────────────────────────────
  //
  // Transforms raw Prisma data into the API response shape.
  //
  // Key transformations:
  //   Decimal → formatted string ("1000.00")
  //   User object → { id, fullName }
  //   Date → ISO 8601 string
  //
  // Why toString() then parseFloat() then toFixed(2)?
  //   Prisma Decimal → .toString() gives exact string "1000"
  //   parseFloat() converts to JS number
  //   .toFixed(2) ensures "1000.00" (always 2 decimal places)
  // ═════════════════════════════════════════════════════════

  // Verifies a user is an active workspace member with
  // check-approver or check-admin role before allowing them
  // to be designated as a rule approver.
  private async validateApproverEligibility(
    workspaceId: string,
    userId: string,
  ) {
    const member = await this.repository.isWorkspaceMember(workspaceId, userId);
    if (!member) {
      throw new ValidationError(
        `User ${userId} is not an active member of this workspace`,
      );
    }

    const hasApproverRole = member.assignedRoles.some(
      (r) => r.role.slug === "check-approver" || r.role.slug === "check-admin",
    );

    if (!hasApproverRole) {
      throw new ValidationError(
        `User ${userId} does not have the approver or admin role in this workspace`,
      );
    }
  }

  private formatApprover(approver: any): ApproverResponse {
    return {
      id: approver.id,
      userId: approver.user.id,
      fullName: approver.user.fullName,
      email: approver.user.email,
    };
  }

  private formatRule(rule: any): ApprovalRuleResponse {
    return {
      id: rule.id,
      minAmount: rule.minAmount
        ? parseFloat(rule.minAmount.toString()).toFixed(2)
        : "0.00",
      maxAmount: rule.maxAmount
        ? parseFloat(rule.maxAmount.toString()).toFixed(2)
        : null,
      priority: rule.priority,
      requiredApprovals: rule.requiredApprovals,
      allowSelfApproval: rule.allowSelfApproval,
      isActive: rule.isActive,
      createdBy: {
        id: rule.createdBy.id,
        fullName: rule.createdBy.fullName,
      },
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
