import { prisma } from "@smartbusiness/database";

// ═══════════════════════════════════════════════════════════════
// APPROVAL RULE REPOSITORY
//
// Database operations for approval workflow rules. Every method
// takes workspaceId as a parameter for workspace-scoped queries.
//
// PATTERN: Same as CheckRepository and BankAccountRepository.
// Each method does one thing, returns raw Prisma data, and lets
// the service handle business logic and formatting.
//
// KEY DIFFERENCES FROM THE DESIGN DOCUMENT:
//
// 1. Import from @smartbusiness/database (shared package)
// 2. USER_SELECT uses fullName (not firstName/lastName)
// 3. Handles all existing schema fields (priority, maxAmount, etc.)
// 4. Adds hasApprovalRecords() for FK-safe deletion
// ═══════════════════════════════════════════════════════════════

const USER_SELECT = {
  id: true,
  fullName: true,
} as const;

const RULE_INCLUDE = {
  createdBy: { select: USER_SELECT },
} as const;

export class ApprovalRuleRepository {
  // ─── Create Rule ─────────────────────────────────────────
  //
  // Prisma handles UUID generation (@default(uuid()))
  // and createdAt timestamp (@default(now())).
  // The @updatedAt on updatedAt is set automatically by Prisma.
  //
  // We pass all fields explicitly rather than spreading the
  // input to prevent mass-assignment vulnerabilities — only
  // the fields we list here can be set on creation.
  // ═════════════════════════════════════════════════════════

  async create(data: {
    workspaceId: string;
    minAmount: number;
    maxAmount?: number | null;
    priority?: number;
    requiredApprovals?: number;
    allowSelfApproval?: boolean;
    createdById: string;
  }) {
    return prisma.approvalWorkflowRule.create({
      data: {
        workspaceId: data.workspaceId,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        priority: data.priority ?? 1,
        requiredApprovals: data.requiredApprovals ?? 1,
        allowSelfApproval: data.allowSelfApproval ?? false,
        createdById: data.createdById,
      },
      include: RULE_INCLUDE,
    });
  }

  // ─── Find by ID ──────────────────────────────────────────
  //
  // Returns null if not found. The SERVICE layer is responsible
  // for checking the workspaceId match (IDOR prevention) and
  // throwing NotFoundError. The repository just fetches.
  // ═════════════════════════════════════════════════════════

  async findById(id: string) {
    return prisma.approvalWorkflowRule.findUnique({
      where: { id },
      include: RULE_INCLUDE,
    });
  }

  // ─── List Rules for a Workspace ──────────────────────────
  //
  // Sorted by priority ASC (lowest priority number first),
  // consistent with how the Check module reads them in
  // findApprovalRules(). This ensures the admin sees rules
  // in the same order the system evaluates them.
  //
  // Promise.all runs count and findMany in parallel — they're
  // independent queries that don't depend on each other.
  // ═════════════════════════════════════════════════════════

  async list(workspaceId: string, includeInactive: boolean = false) {
    const where = includeInactive
      ? { workspaceId }
      : { workspaceId, isActive: true };

    const [items, total] = await Promise.all([
      prisma.approvalWorkflowRule.findMany({
        where,
        include: RULE_INCLUDE,
        orderBy: { priority: "asc" },
      }),
      prisma.approvalWorkflowRule.count({ where }),
    ]);

    return { items, total };
  }

  // ─── Check for Duplicate Min Amount ──────────────────────
  //
  // Before creating or updating, verify no other ACTIVE rule
  // in the same workspace has the same minAmount. Two rules
  // with minAmount: $1,000 but different maxAmounts are valid,
  // but two rules with identical minAmount AND maxAmount are
  // confusing and likely a mistake.
  //
  // excludeId: used during updates so the rule being updated
  // doesn't count as its own duplicate.
  // ═════════════════════════════════════════════════════════

  async findDuplicate(
    workspaceId: string,
    minAmount: number,
    maxAmount: number | null | undefined,
    excludeId?: string,
  ) {
    return prisma.approvalWorkflowRule.findFirst({
      where: {
        workspaceId,
        minAmount,
        maxAmount: maxAmount ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  // ─── Update Rule ─────────────────────────────────────────
  //
  // Only updates fields that are provided. Prisma's @updatedAt
  // on the updatedAt column handles the timestamp automatically.
  // ═════════════════════════════════════════════════════════

  async update(
    id: string,
    data: {
      minAmount?: number;
      maxAmount?: number | null;
      priority?: number;
      requiredApprovals?: number;
      allowSelfApproval?: boolean;
    },
  ) {
    return prisma.approvalWorkflowRule.update({
      where: { id },
      data,
      include: RULE_INCLUDE,
    });
  }

  // ─── Set Active Status ───────────────────────────────────
  //
  // Used by both activate and deactivate endpoints. A single
  // method with a boolean parameter avoids code duplication.
  // ═════════════════════════════════════════════════════════

  async setActive(id: string, isActive: boolean) {
    return prisma.approvalWorkflowRule.update({
      where: { id },
      data: { isActive },
      include: RULE_INCLUDE,
    });
  }

  // ─── Delete Rule ─────────────────────────────────────────
  //
  // Hard delete. Unlike checks (which must be voided for audit
  // trail), approval rules are configuration data.
  //
  // IMPORTANT: Call hasApprovalRecords() first. If any
  // ApprovalRecord references this rule via ruleId FK,
  // this delete will fail with a foreign key violation.
  // ═════════════════════════════════════════════════════════

  async delete(id: string) {
    return prisma.approvalWorkflowRule.delete({
      where: { id },
    });
  }

  // ─── Check for Existing Approval Records ─────────────────
  //
  // Before deleting a rule, we must check if any ApprovalRecord
  // references it. The ApprovalRecord table has:
  //   ruleId String @map("rule_id")
  //   rule ApprovalWorkflowRule @relation(...)
  //
  // If any records exist, deleting the rule would violate the
  // FK constraint and PostgreSQL would throw an error. We check
  // first to give a clean error message instead of a cryptic
  // database error.
  // ═════════════════════════════════════════════════════════

  async hasApprovalRecords(ruleId: string): Promise<boolean> {
    const count = await prisma.approvalRecord.count({
      where: { ruleId },
    });
    return count > 0;
  }

  // The approval master switch lives in check-printing settings and is read and
  // written through CheckPrintingSettingsService.

  // ═══════════════════════════════════════════════════════════
  // APPROVER MANAGEMENT
  //
  // The ApprovalWorkflowApprover junction table links rules to
  // designated users. These methods manage that relationship.
  // ═══════════════════════════════════════════════════════════

  async listApprovers(ruleId: string) {
    return prisma.approvalWorkflowApprover.findMany({
      where: { ruleId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async findApprover(ruleId: string, userId: string) {
    return prisma.approvalWorkflowApprover.findUnique({
      where: { ruleId_userId: { ruleId, userId } },
    });
  }

  async addApprover(ruleId: string, userId: string) {
    return prisma.approvalWorkflowApprover.create({
      data: { ruleId, userId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async removeApprover(ruleId: string, userId: string) {
    return prisma.approvalWorkflowApprover.delete({
      where: { ruleId_userId: { ruleId, userId } },
    });
  }

  // Replaces ALL approvers for a rule in a single transaction.
  // Delete all existing → create new ones. Since the junction
  // table has no extra fields, nothing is lost by recreating.
  async syncApprovers(ruleId: string, userIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.approvalWorkflowApprover.deleteMany({
        where: { ruleId },
      });

      if (userIds.length > 0) {
        await tx.approvalWorkflowApprover.createMany({
          data: userIds.map((userId) => ({ ruleId, userId })),
        });
      }

      return tx.approvalWorkflowApprover.findMany({
        where: { ruleId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    });
  }

  // Finds workspace members who have the check-approver or
  // check-admin role. These are the only users who should be
  // designatable as approvers for a rule.
  async findEligibleApprovers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        assignedRoles: {
          some: {
            role: {
              slug: { in: ["check-approver", "check-admin"] },
            },
          },
        },
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        assignedRoles: {
          include: {
            role: { select: { slug: true, name: true } },
          },
        },
      },
    });
  }

  // Verifies a user is an active workspace member. Used before
  // assigning them as an approver.
  async isWorkspaceMember(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: {
        deletedAt: true,
        assignedRoles: {
          include: {
            role: { select: { slug: true } },
          },
        },
      },
    });

    if (!member || member.deletedAt) return null;
    return member;
  }
}
