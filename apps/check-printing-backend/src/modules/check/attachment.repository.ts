import { prisma, type CheckStatus } from "@smartbusiness/database";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors/index.js";

// Attachments may change only while the check is a draft or was rejected; after
// submission they are frozen, so the record shows exactly what the approver saw.
export const ATTACHMENT_EDITABLE_STATUSES: CheckStatus[] = ["NEW", "REJECTED"];

export const ATTACHMENT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxCheckBytes: 25 * 1024 * 1024,
  maxFiles: 10,
} as const;

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

const ATTACHMENT_SELECT = {
  id: true,
  checkId: true,
  fileName: true,
  fileType: true,
  fileSizeBytes: true,
  storageKey: true,
  sha256: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} as const;

export interface NewAttachment {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  storageKey: string;
  sha256: string;
}

export class AttachmentRepository {
  // Locks the check, re-checks every rule against the locked row, and inserts.
  // Two simultaneous uploads take turns, so they cannot both slip under the limits.
  async add(checkId: string, workspaceId: string, userId: string, file: NewAttachment) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string; created_by_id: string; check_number: number }[]>`
        SELECT status::text AS status, created_by_id, check_number
        FROM checks
        WHERE id = ${checkId} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
        FOR UPDATE`;
      const check = locked[0];
      if (!check) throw new NotFoundError("Check");
      assertEditable(check.status as CheckStatus, check.check_number);
      if (check.created_by_id !== userId) {
        throw new ForbiddenError("Only the person who created this check can change its attachments.");
      }

      const totals = await tx.checkAttachment.aggregate({
        where: { checkId },
        _count: { _all: true },
        _sum: { fileSizeBytes: true },
      });
      if (totals._count._all >= ATTACHMENT_LIMITS.maxFiles) {
        throw new AppError(
          `A check can have at most ${ATTACHMENT_LIMITS.maxFiles} attachments. Remove one before adding another.`,
          422,
          "TOO_MANY_ATTACHMENTS",
        );
      }
      const usedBytes = Number(totals._sum.fileSizeBytes ?? 0);
      if (usedBytes + file.fileSizeBytes > ATTACHMENT_LIMITS.maxCheckBytes) {
        throw new AppError(
          "A check's attachments can total at most 25 MB. Remove a file or upload a smaller one.",
          413,
          "ATTACHMENTS_TOO_LARGE",
        );
      }

      return tx.checkAttachment.create({
        data: { checkId, uploadedById: userId, ...file, fileSizeBytes: BigInt(file.fileSizeBytes) },
        select: ATTACHMENT_SELECT,
      });
    }, TX_OPTIONS);
  }

  async checkExists(checkId: string, workspaceId: string): Promise<boolean> {
    return (await prisma.check.count({ where: { id: checkId, workspaceId, deletedAt: null } })) > 0;
  }

  async list(checkId: string, workspaceId: string) {
    return prisma.checkAttachment.findMany({
      where: { checkId, check: { workspaceId, deletedAt: null } },
      select: ATTACHMENT_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  // Scoped through the check to the workspace: another company's id finds nothing.
  async find(attachmentId: string, checkId: string, workspaceId: string) {
    return prisma.checkAttachment.findFirst({
      where: { id: attachmentId, checkId, check: { workspaceId, deletedAt: null } },
      select: ATTACHMENT_SELECT,
    });
  }

  // Removes the row under the same lock and rules as add(). Returns the removed row and
  // whether its stored file is still used by another attachment (a reissued check shares
  // its original's files), so the caller deletes the file only when nothing uses it.
  async remove(attachmentId: string, checkId: string, workspaceId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string; created_by_id: string; check_number: number }[]>`
        SELECT status::text AS status, created_by_id, check_number
        FROM checks
        WHERE id = ${checkId} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
        FOR UPDATE`;
      const check = locked[0];
      if (!check) throw new NotFoundError("Check");
      assertEditable(check.status as CheckStatus, check.check_number);
      if (check.created_by_id !== userId) {
        throw new ForbiddenError("Only the person who created this check can change its attachments.");
      }

      const attachment = await tx.checkAttachment.findFirst({ where: { id: attachmentId, checkId }, select: ATTACHMENT_SELECT });
      if (!attachment) throw new NotFoundError("Attachment");

      await tx.checkAttachment.delete({ where: { id: attachmentId } });
      const stillUsed = await tx.checkAttachment.count({ where: { storageKey: attachment.storageKey } });
      return { attachment, fileStillUsed: stillUsed > 0 };
    }, TX_OPTIONS);
  }
}

function assertEditable(status: CheckStatus, checkNumber: number): void {
  if (!ATTACHMENT_EDITABLE_STATUSES.includes(status)) {
    throw new ConflictError(
      `Check #${checkNumber} was already submitted, so its attachments can no longer change. ` +
        "They stay exactly as the approver saw them.",
    );
  }
}
