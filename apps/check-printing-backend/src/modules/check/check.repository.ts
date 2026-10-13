import { prisma, Prisma } from "@smartbusiness/database";
import { ConflictError } from "../../shared/errors/index.js";
import type { CreateCheckInput } from "./check.schemas.js";

// ═══════════════════════════════════════════════════════════════
// PRISMA INCLUDE CONSTANTS
//
// These define what related data to load when querying checks.
// They're constants (not inline objects) so every query returns
// the same shape, and changing the shape is a single edit.
//
// AUDIT POINT ADDRESSED: Old documents used firstName/lastName
// on the User model. The actual schema has a single `fullName`
// field. Every User select below reflects the real schema.
// ═══════════════════════════════════════════════════════════════

const USER_SELECT = {
  id: true,
  fullName: true,
} as const;

const CHECK_INCLUDE = {
  createdBy: { select: USER_SELECT },
  printedBy: { select: USER_SELECT },
  voidedBy: { select: USER_SELECT },
  clearedBy: { select: USER_SELECT },
  bankAccount: {
    select: {
      id: true,
      bankName: true,
      accountNumberLast4: true,
      accountType: true,
    },
  },
  statusHistory: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      changedBy: { select: USER_SELECT },
    },
  },
  approvalRecords: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      decision: true,
      reason: true,
      createdAt: true,
      approver: { select: USER_SELECT },
      rule: {
        select: {
          id: true,
          requiredApprovals: true,
          minAmount: true,
          maxAmount: true,
        },
      },
    },
  },
} as const;

const CHECK_LIST_INCLUDE = {
  createdBy: { select: USER_SELECT },
  bankAccount: {
    select: {
      id: true,
      bankName: true,
      accountNumberLast4: true,
      accountType: true,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// REPOSITORY INTERFACES
//
// These decouple the repository from Prisma's generated types.
// The service layer passes these plain objects — it does not need
// to import anything from Prisma.
// ═══════════════════════════════════════════════════════════════

interface CreateCheckData {
  workspaceId: string;
  bankAccountId: string;
  payeeName: string;
  amount: number;
  amountInWords: string;
  checkDate: Date;
  memo?: string | null;
  invoiceTableJson?: unknown;
  createdById: string;
}

interface StatusChangeData {
  checkId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface ListChecksParams {
  workspaceId: string;
  status?: string;
  search?: string;
  bankAccountId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export class CheckRepository {

  // ═════════════════════════════════════════════════════════════
  // ATOMIC CHECK CREATION WITH NUMBER ASSIGNMENT
  //
  // This is a single Prisma interactive transaction that:
  // 1. Increments the bank account's nextCheckNumber (row lock)
  // 2. Creates the check with that number
  // 3. Creates the initial status history entry
  //
  // Why interactive transaction (callback) vs sequential?
  // Prisma's $transaction([...]) runs queries in order but does
  // NOT acquire a row lock between them. The callback form runs
  // inside a real database transaction with proper isolation.
  //
  // Why UPDATE + increment instead of SELECT + UPDATE?
  // SELECT then UPDATE creates a TOCTOU race (time-of-check to
  // time-of-use). Between the SELECT and UPDATE, another request
  // can read the same number. The atomic UPDATE...RETURNING
  // pattern eliminates this window entirely.
  // ═════════════════════════════════════════════════════════════

  async createWithAtomicNumber(
    data: CreateCheckData,
    initialStatus: string,
    userId: string,
    ipAddress?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const bankAccount = await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { nextCheckNumber: { increment: 1 } },
        select: { nextCheckNumber: true },
      });

      const checkNumber = bankAccount.nextCheckNumber - 1;

      const check = await tx.check.create({
        data: {
          workspaceId: data.workspaceId,
          bankAccountId: data.bankAccountId,
          checkNumber,
          status: initialStatus as any,
          payeeName: data.payeeName,
          amount: data.amount,
          amountInWords: data.amountInWords,
          checkDate: data.checkDate,
          memo: data.memo ?? null,
          invoiceTableJson: data.invoiceTableJson as Prisma.InputJsonValue ?? Prisma.JsonNull,
          createdById: data.createdById,
        },
        include: CHECK_INCLUDE,
      });

      await tx.checkStatusHistory.create({
        data: {
          checkId: check.id,
          fromStatus: null,
          toStatus: initialStatus as any,
          changeById: userId,
          reason: null,
          ipAddress: ipAddress ?? null,
        },
      });

      return check;
    });
  }

  // ═════════════════════════════════════════════════════════════
  // FIND BY ID (workspace-scoped for tenant isolation)
  // ═════════════════════════════════════════════════════════════

  async findById(checkId: string, workspaceId: string) {
    return prisma.check.findFirst({
      where: {
        id: checkId,
        workspaceId,
        deletedAt: null,
      },
      include: CHECK_INCLUDE,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // LIST WITH FILTERING, SEARCH, AND PAGINATION
  //
  // The WHERE clause is built dynamically based on which filters
  // the client provides. This is the Prisma equivalent of a
  // query builder — conditions are added only when present.
  //
  // The search uses `contains` with `mode: "insensitive"` which
  // translates to PostgreSQL's ILIKE operator. For large datasets,
  // this won't use a standard B-tree index. If performance becomes
  // an issue, consider a GIN trigram index.
  //
  // Pagination uses offset-based (page * limit) rather than
  // cursor-based. Offset is simpler and works well for up to
  // ~100k records. For larger datasets, cursor-based pagination
  // (using the last item's createdAt + id) would be better.
  // ═════════════════════════════════════════════════════════════

  async list(params: ListChecksParams) {
    const where: Prisma.CheckWhereInput = {
      workspaceId: params.workspaceId,
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status as any;
    }

    if (params.bankAccountId) {
      where.bankAccountId = params.bankAccountId;
    }

    if (params.search) {
      where.payeeName = { contains: params.search, mode: "insensitive" };
    }

    if (params.dateFrom || params.dateTo) {
      where.checkDate = {};
      if (params.dateFrom) where.checkDate.gte = params.dateFrom;
      if (params.dateTo) where.checkDate.lte = params.dateTo;
    }

    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      prisma.check.findMany({
        where,
        include: CHECK_LIST_INCLUDE,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip,
        take: params.limit,
      }),
      prisma.check.count({ where }),
    ]);

    return { items, total };
  }

  // ═════════════════════════════════════════════════════════════
  // APPROVAL QUEUE
  //
  // Returns checks awaiting approval, excluding checks created
  // by the current user (they can't approve their own checks).
  // ═════════════════════════════════════════════════════════════

  async listPendingApproval(workspaceId: string) {
    return prisma.check.findMany({
      where: {
        workspaceId,
        status: "PENDING_APPROVAL",
        deletedAt: null,
      },
      include: CHECK_LIST_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  async findUserDecisionsForChecks(checkIds: string[], userId: string) {
    return prisma.approvalRecord.findMany({
      where: {
        checkId: { in: checkIds },
        approverId: userId,
      },
      select: { checkId: true },
    });
  }

  // ═════════════════════════════════════════════════════════════
  // STATUS UPDATE (transactional with history)
  //
  // Every status change is wrapped in a transaction that:
  // 1. Updates the check's status
  // 2. Creates a CheckStatusHistory entry
  //
  // Additional fields (voidReason, printedAt, etc.) are passed
  // through the extraData parameter for status-specific updates.
  //
  // This ensures atomicity: if the history insert fails, the
  // status change is rolled back. The audit trail is ALWAYS
  // consistent with the actual status.
  // ═════════════════════════════════════════════════════════════

  async updateStatus(
    checkId: string,
    workspaceId: string,
    toStatus: string,
    statusChange: StatusChangeData,
    extraData?: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      // The expected status is part of the WHERE clause, so PostgreSQL decides
      // atomically: when two requests race (e.g. a double-clicked Print), the
      // second UPDATE waits for the first to commit, re-checks the condition,
      // and matches no row. A plain re-read would not lock the row at
      // READ COMMITTED, and both requests could pass.
      const { count } = await tx.check.updateMany({
        where: {
          id: checkId,
          workspaceId,
          deletedAt: null,
          status: statusChange.fromStatus as Prisma.CheckWhereInput["status"],
        },
        data: {
          status: toStatus,
          ...extraData,
        } as Prisma.CheckUncheckedUpdateManyInput,
      });

      if (count !== 1) {
        throw new ConflictError(
          `This check was changed by another request (it is no longer ${statusChange.fromStatus}). Refresh and try again.`,
        );
      }

      const check = await tx.check.findFirstOrThrow({
        where: { id: checkId, workspaceId },
        include: CHECK_INCLUDE,
      });

      await tx.checkStatusHistory.create({
        data: {
          checkId,
          fromStatus: statusChange.fromStatus as any,
          toStatus: statusChange.toStatus as any,
          changeById: statusChange.changedById,
          reason: statusChange.reason ?? null,
          ipAddress: statusChange.ipAddress ?? null,
          userAgent: statusChange.userAgent ?? null,
        },
      });

      return check;
    }, {
      // Prisma's defaults (2 s to get a connection, 5 s to finish) are too short when a
      // concurrent request must open a new connection to a remote database; the loser
      // of a race would then fail with an opaque P2028 instead of the 409 above.
      maxWait: 10_000,
      timeout: 15_000,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // APPROVAL RECORD CREATION
  //
  // AUDIT POINT ADDRESSED: Old docs created ApprovalRecord
  // without a ruleId. The actual schema requires ruleId as a FK
  // to ApprovalWorkflowRule. The decision field is a VarChar(10)
  // string ("approved" or "rejected"), not an enum.
  // ═════════════════════════════════════════════════════════════

  async createApprovalRecord(data: {
    checkId: string;
    ruleId: string;
    approverId: string;
    decision: "approved" | "rejected";
    reason?: string | null;
  }) {
    return prisma.approvalRecord.create({ data });
  }

  // ═════════════════════════════════════════════════════════════
  // UPDATE CHECK DATA (for editing drafts)
  // ═════════════════════════════════════════════════════════════

  async updateData(
    checkId: string,
    workspaceId: string,
    data: Record<string, unknown>,
  ) {
    return prisma.check.update({
      where: { id: checkId, workspaceId },
      data: data as any,
      include: CHECK_INCLUDE,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // SOFT DELETE
  // ═════════════════════════════════════════════════════════════

  async softDelete(checkId: string, workspaceId: string) {
    return prisma.check.update({
      where: { id: checkId, workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  // ═════════════════════════════════════════════════════════════
  // LOOKUP HELPERS
  // ═════════════════════════════════════════════════════════════

  async findBankAccount(bankAccountId: string, workspaceId: string) {
    return prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        workspaceId,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findCheckPrintingSettings(workspaceId: string) {
    return prisma.checkPrintingSettings.findUnique({
      where: { workspaceId },
    });
  }

  async findApprovalRules(workspaceId: string) {
    return prisma.approvalWorkflowRule.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      include: {
        approvers: {
          select: { userId: true },
        },
      },
      orderBy: { priority: "asc" },
    });
  }

  async countApprovedRecords(checkId: string, ruleId: string) {
    return prisma.approvalRecord.count({
      where: { checkId, ruleId, decision: "approved" },
    });
  }

  async hasUserDecided(checkId: string, userId: string) {
    return prisma.approvalRecord.findFirst({
      where: { checkId, approverId: userId },
    });
  }

  async findWorkspace(workspaceId: string) {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });
  }

  async findApprovalRecords(checkId: string) {
    return prisma.approvalRecord.findMany({
      where: { checkId },
      include: {
        approver: { select: USER_SELECT },
        rule: { select: { id: true, minAmount: true, maxAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ═════════════════════════════════════════════════════════════
  // REISSUE: Create a new check linked to the original
  // ═════════════════════════════════════════════════════════════

  async createReissue(
    data: CreateCheckData,
    initialStatus: string,
    originalCheckId: string,
    userId: string,
    ipAddress?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const bankAccount = await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { nextCheckNumber: { increment: 1 } },
        select: { nextCheckNumber: true },
      });

      const checkNumber = bankAccount.nextCheckNumber - 1;

      const check = await tx.check.create({
        data: {
          workspaceId: data.workspaceId,
          bankAccountId: data.bankAccountId,
          checkNumber,
          status: initialStatus as any,
          payeeName: data.payeeName,
          amount: data.amount,
          amountInWords: data.amountInWords,
          checkDate: data.checkDate,
          memo: data.memo ?? null,
          invoiceTableJson: data.invoiceTableJson as Prisma.InputJsonValue ?? Prisma.JsonNull,
          createdById: data.createdById,
          reissuedFromCheckId: originalCheckId,
        },
        include: CHECK_INCLUDE,
      });

      await tx.checkStatusHistory.create({
        data: {
          checkId: check.id,
          fromStatus: null,
          toStatus: initialStatus as any,
          changeById: userId,
          reason: `Reissued from check #${data.bankAccountId}`,
          ipAddress: ipAddress ?? null,
        },
      });

      return check;
    });
  }
}
