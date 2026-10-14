import { prisma, Prisma } from "@smartbusiness/database";
import { logger } from "./logger.js";
import { AppError } from "../errors/index.js";

export interface AuditEntry {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export class AuditService {
  /** Best effort: a failed write is logged and the caller carries on. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.write(entry);
    } catch (err) {
      logger.error({ err, audit: entry }, "Failed to write audit log");
    }
  }

  /**
   * For actions that must not happen unrecorded, such as handing out a check PDF:
   * if the audit row cannot be written, the action is refused.
   */
  async logOrRefuse(entry: AuditEntry): Promise<void> {
    try {
      await this.write(entry);
    } catch (err) {
      logger.error({ err, audit: entry }, "Failed to write required audit log; action refused");
      throw new AppError(
        "This action could not be recorded in the audit log, so it was not performed. Try again shortly.",
        503,
        "AUDIT_UNAVAILABLE",
      );
    }
  }

  private async write(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        workspaceId: entry.workspaceId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        detailsJson: (entry.details as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
