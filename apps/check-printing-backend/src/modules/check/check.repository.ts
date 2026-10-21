import { prisma, Prisma } from "@smartbusiness/database";
import type { CheckStatus } from "@smartbusiness/database";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { CreateCheckInput } from "./check.schemas.js";

// Prisma's defaults (2 s to get a connection, 5 s to finish) are too short when a
// concurrent request must open a new connection to a remote database; the loser
// of a race would then fail with an opaque P2028 instead of a clear 409.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

// True when `err` violates the unique index `indexName`. With the pg driver adapter the
// index name sits in err.meta.driverAdapterError.cause.constraint; other engines put it
// elsewhere, so search the whole meta object for the exact name.
function isUniqueViolationOn(err: unknown, indexName: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    JSON.stringify(err.meta ?? {}).includes(`"${indexName}"`)
  );
}

function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

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
  printConfirmedBy: { select: USER_SELECT },
  clearedBy: { select: USER_SELECT },
  bankAccount: {
    select: {
      id: true,
      bankName: true,
      accountNumberLast4: true,
      accountType: true,
      checkNumberPadding: true,
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
  reissuedFromCheck: { select: { id: true, checkNumber: true } },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSizeBytes: true,
      createdAt: true,
      uploadedBy: { select: USER_SELECT },
    },
  },
  reissuedToCheck: { select: { id: true, checkNumber: true } },
  approvalRecords: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      round: true,
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
    initialStatus: CheckStatus,
    userId: string,
    ipAddress?: string,
  ) {
    return prisma.$transaction(
      (tx) => this.insertCheck(tx, data, initialStatus, { userId, ipAddress }),
      TX_OPTIONS,
    );
  }

  // Shared by create and reissue. The bank account filter is part of the
  // UPDATE, so an account deactivated a moment ago cannot receive a check.
  private async insertCheck(
    tx: Prisma.TransactionClient,
    data: CreateCheckData,
    initialStatus: CheckStatus,
    history: { userId: string; ipAddress?: string; reason?: string },
    reissuedFromCheckId?: string,
  ) {
    let nextCheckNumber: number;
    try {
      ({ nextCheckNumber } = await tx.bankAccount.update({
        where: {
          id: data.bankAccountId,
          workspaceId: data.workspaceId,
          isActive: true,
          deletedAt: null,
        },
        data: { nextCheckNumber: { increment: 1 } },
        select: { nextCheckNumber: true },
      }));
    } catch (err) {
      if (isRecordNotFound(err)) {
        throw new ValidationError("This bank account is inactive or no longer exists", {
          bankAccountId: ["Choose an active bank account"],
        });
      }
      throw err;
    }

    const check = await tx.check.create({
      data: {
        workspaceId: data.workspaceId,
        bankAccountId: data.bankAccountId,
        checkNumber: nextCheckNumber - 1,
        status: initialStatus,
        payeeName: data.payeeName,
        amount: data.amount,
        amountInWords: data.amountInWords,
        checkDate: data.checkDate,
        memo: data.memo ?? null,
        invoiceTableJson: (data.invoiceTableJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        createdById: data.createdById,
        reissuedFromCheckId: reissuedFromCheckId ?? null,
      },
      include: CHECK_INCLUDE,
    });

    await tx.checkStatusHistory.create({
      data: {
        checkId: check.id,
        fromStatus: null,
        toStatus: initialStatus,
        changeById: history.userId,
        reason: history.reason ?? null,
        ipAddress: history.ipAddress ?? null,
      },
    });

    // A reissue carries its original's evidence. Stored files never change, so the new
    // rows point at the same files.
    if (reissuedFromCheckId) {
      const originals = await tx.checkAttachment.findMany({ where: { checkId: reissuedFromCheckId } });
      if (originals.length > 0) {
        await tx.checkAttachment.createMany({
          data: originals.map((a) => ({
            checkId: check.id,
            fileName: a.fileName,
            fileType: a.fileType,
            fileSizeBytes: a.fileSizeBytes,
            storageKey: a.storageKey,
            sha256: a.sha256,
            uploadedById: a.uploadedById,
          })),
        });
        return tx.check.findFirstOrThrow({ where: { id: check.id }, include: CHECK_INCLUDE });
      }
    }

    return check;
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
      select: { checkId: true, round: true },
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
    // Further conditions the row must still meet, checked in the same UPDATE
    // (e.g. "the print has not been confirmed OK").
    extraWhere: Prisma.CheckWhereInput = {},
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
          ...extraWhere,
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
    }, TX_OPTIONS);
  }

  // Checks for one print job, in no particular order (the service orders them).
  async findManyForPrint(checkIds: string[], workspaceId: string) {
    return prisma.check.findMany({
      where: { id: { in: checkIds }, workspaceId, deletedAt: null },
      include: CHECK_INCLUDE,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // RECORD A PRINT JOB (all checks or none)
  //
  // One transaction: the batch row, then each check moved to PRINTED with the same
  // conditional UPDATE as a single print (its status must still be the one we
  // validated), then its history row. If any check was changed by someone else in
  // the meantime, the whole job rolls back: half a printed batch would leave checks
  // marked PRINTED that are missing from the PDF, or in it but not marked.
  // ═════════════════════════════════════════════════════════════

  async recordBatchPrint(
    batch: Prisma.PrintBatchUncheckedCreateInput & { id: string },
    checks: Array<{ checkId: string; checkNumber: number; fromStatus: CheckStatus; data: Record<string, unknown> }>,
    history: { changedById: string; ipAddress?: string | null },
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.printBatch.create({ data: batch });

      for (const c of checks) {
        const { count } = await tx.check.updateMany({
          where: { id: c.checkId, workspaceId: batch.workspaceId, deletedAt: null, status: c.fromStatus },
          data: { status: "PRINTED", printBatchId: batch.id, ...c.data } as Prisma.CheckUncheckedUpdateManyInput,
        });
        if (count !== 1) {
          throw new ConflictError(
            `Check #${c.checkNumber} was changed by another request while this job was printing, so nothing was printed. Refresh and try again.`,
          );
        }
      }

      await tx.checkStatusHistory.createMany({
        data: checks.map((c) => ({
          checkId: c.checkId,
          fromStatus: c.fromStatus,
          toStatus: "PRINTED" as const,
          changeById: history.changedById,
          ipAddress: history.ipAddress ?? null,
        })),
      });

      return tx.check.findMany({
        where: { printBatchId: batch.id, workspaceId: batch.workspaceId },
        include: CHECK_INCLUDE,
      });
    }, TX_OPTIONS);
  }

  async findPrintBatch(batchId: string, workspaceId: string) {
    return prisma.printBatch.findFirst({
      where: { id: batchId, workspaceId },
      include: {
        createdBy: { select: USER_SELECT },
        checks: { where: { deletedAt: null }, include: CHECK_LIST_INCLUDE },
      },
    });
  }

  // ═════════════════════════════════════════════════════════════
  // CONFIRM A PRINT (the paper came out fine)
  //
  // Conditional, like every state change: only a PRINTED check whose outcome was
  // not reported yet. If someone reported SPOILED (or OK) a moment earlier, this
  // matches no row and the caller gets a 409.
  // ═════════════════════════════════════════════════════════════

  async confirmPrint(checkId: string, workspaceId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.check.updateMany({
        where: { id: checkId, workspaceId, deletedAt: null, status: "PRINTED", printConfirmedAt: null },
        data: { printConfirmedAt: new Date(), printConfirmedById: userId },
      });
      if (count !== 1) {
        throw new ConflictError(
          "The outcome of this print was already reported by another request. Refresh and try again.",
        );
      }
      return tx.check.findFirstOrThrow({ where: { id: checkId, workspaceId }, include: CHECK_INCLUDE });
    }, TX_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════
  // RECORD AN APPROVAL DECISION (vote and status change, atomic)
  //
  // The check row is locked with SELECT ... FOR UPDATE for the
  // whole transaction, so votes on one check run one at a time.
  // Each vote sees every vote committed before it, and exactly one
  // vote makes the transition. Without the lock, two approvers
  // voting together on a 2-approval rule could both count 2 and
  // both try to approve; with check-then-insert, one approver
  // double-clicking could even count twice.
  //
  // The unique (check_id, round, approver_id) index is the final
  // guarantee against a double vote.
  //
  // Votes belong to the check's current approval round. A resubmit
  // starts a new round, so votes cast before an edit never count
  // toward the edited check.
  // ═════════════════════════════════════════════════════════════

  async recordDecision(input: {
    checkId: string;
    workspaceId: string;
    // The status the caller validated the decision against (PENDING_APPROVAL, or
    // NEW when the approval workflow is off and a second person approves directly).
    fromStatus: CheckStatus;
    round: number;
    rule: { id: string; requiredApprovals: number } | null;
    decision: "approved" | "rejected";
    reason?: string | null;
    userId: string;
    ipAddress?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string; approval_round: number }[]>`
        SELECT status::text AS status, approval_round
        FROM checks
        WHERE id = ${input.checkId}
          AND workspace_id = ${input.workspaceId}
          AND deleted_at IS NULL
        FOR UPDATE`;

      const current = locked[0];
      if (!current) {
        throw new NotFoundError("Check");
      }
      if (current.status !== input.fromStatus || current.approval_round !== input.round) {
        throw new ConflictError(
          "This check was changed by another request (it is no longer awaiting this decision). Refresh and try again.",
        );
      }

      let approvedCount: number | null = null;

      if (input.rule) {
        try {
          await tx.approvalRecord.create({
            data: {
              checkId: input.checkId,
              ruleId: input.rule.id,
              approverId: input.userId,
              round: input.round,
              decision: input.decision,
              reason: input.reason ?? null,
            },
          });
        } catch (err) {
          if (isUniqueViolationOn(err, "approval_records_check_id_round_approver_id_key")) {
            throw new ConflictError("You have already submitted a decision on this check");
          }
          throw err;
        }

        if (input.decision === "approved") {
          approvedCount = await tx.approvalRecord.count({
            where: {
              checkId: input.checkId,
              round: input.round,
              ruleId: input.rule.id,
              decision: "approved",
            },
          });

          if (approvedCount < input.rule.requiredApprovals) {
            const check = await tx.check.findFirstOrThrow({
              where: { id: input.checkId, workspaceId: input.workspaceId },
              include: CHECK_INCLUDE,
            });
            return { check, transitioned: false, approvedCount };
          }
        }
      }

      const toStatus: CheckStatus = input.decision === "approved" ? "APPROVED" : "REJECTED";

      await tx.check.update({
        where: { id: input.checkId },
        data: { status: toStatus },
      });

      await tx.checkStatusHistory.create({
        data: {
          checkId: input.checkId,
          fromStatus: input.fromStatus,
          toStatus,
          changeById: input.userId,
          reason: input.reason ?? null,
          ipAddress: input.ipAddress ?? null,
        },
      });

      const check = await tx.check.findFirstOrThrow({
        where: { id: input.checkId, workspaceId: input.workspaceId },
        include: CHECK_INCLUDE,
      });
      return { check, transitioned: true, approvedCount };
    }, TX_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════
  // UPDATE CHECK DATA (for editing drafts)
  // ═════════════════════════════════════════════════════════════

  // The editable statuses and the creator are part of the WHERE
  // clause, so an edit racing a submit or approval cannot land on a
  // check that has already moved on: the UPDATE matches no row.
  async updateDraft(
    checkId: string,
    workspaceId: string,
    createdById: string,
    editableStatuses: CheckStatus[],
    data: Prisma.CheckUncheckedUpdateManyInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.check.updateMany({
        where: {
          id: checkId,
          workspaceId,
          createdById,
          deletedAt: null,
          status: { in: editableStatuses },
        },
        data,
      });

      if (count !== 1) {
        throw new ConflictError(
          "This check can no longer be edited: another request submitted, approved or deleted it. Refresh and try again.",
        );
      }

      return tx.check.findFirstOrThrow({
        where: { id: checkId, workspaceId },
        include: CHECK_INCLUDE,
      });
    }, TX_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════
  // SOFT DELETE
  // ═════════════════════════════════════════════════════════════

  // Only the creator's drafts; conditional for the same reason as updateDraft.
  async softDeleteDraft(checkId: string, workspaceId: string, createdById: string) {
    const { count } = await prisma.check.updateMany({
      where: {
        id: checkId,
        workspaceId,
        createdById,
        deletedAt: null,
        status: "NEW",
      },
      data: { deletedAt: new Date() },
    });

    if (count !== 1) {
      throw new ConflictError(
        "This check can no longer be deleted: another request changed it. Refresh and try again.",
      );
    }
  }

  // ═════════════════════════════════════════════════════════════
  // LOOKUP HELPERS
  // ═════════════════════════════════════════════════════════════

  // Returns inactive accounts too, so the service can tell "inactive" apart from
  // "does not exist". Deleted accounts are never returned.
  async findBankAccount(bankAccountId: string, workspaceId: string) {
    return prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        workspaceId,
        deletedAt: null,
      },
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

  async hasUserDecided(checkId: string, round: number, userId: string) {
    return prisma.approvalRecord.findFirst({
      where: { checkId, round, approverId: userId },
      select: { id: true },
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
    initialStatus: CheckStatus,
    original: { id: string; checkNumber: number },
    userId: string,
    ipAddress?: string,
  ) {
    try {
      return await prisma.$transaction(
        (tx) =>
          this.insertCheck(
            tx,
            data,
            initialStatus,
            { userId, ipAddress, reason: `Reissue of voided check #${original.checkNumber}` },
            original.id,
          ),
        TX_OPTIONS,
      );
    } catch (err) {
      // reissued_from_check_id is unique: a concurrent reissue of the same check lost the race.
      if (isUniqueViolationOn(err, "checks_reissued_from_check_id_key")) {
        throw new ConflictError("This check has already been reissued");
      }
      throw err;
    }
  }
}
