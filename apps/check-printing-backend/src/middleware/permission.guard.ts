import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "@smartbusiness/auth";
import type { PermissionAction } from "../shared/constants/rbac.js";
import { AuditService } from "../shared/services/audit.service.js";

const auditService = new AuditService();

export function requirePermission(...actions: PermissionAction[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPermissions = req.permissions ?? [];

    const missing = actions.filter((a) => !userPermissions.includes(a));

    if (missing.length > 0) {
      auditService.log({
        tenantId: req.tenant!.tenantId,
        userId: req.user!.userId,
        workspaceId: req.workspace?.workspaceId,
        action: "ACCESS_DENIED",
        entityType: "Permission",
        entityId: req.user!.userId,
        details: {
          required: actions,
          missing,
          url: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.ip,
      });

      throw new ForbiddenError("You do not have permission to perform this action");
    }

    next();
  };
}
