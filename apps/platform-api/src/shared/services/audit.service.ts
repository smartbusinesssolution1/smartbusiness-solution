import { prisma, Prisma } from "@smartbusiness/database";
import { logger } from "./logger.js";

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
  async log(entry: AuditEntry): Promise<void> {
    try {
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
    } catch (err) {
      logger.error({ err, audit: entry }, "Failed to write audit log");
    }
  }
}
