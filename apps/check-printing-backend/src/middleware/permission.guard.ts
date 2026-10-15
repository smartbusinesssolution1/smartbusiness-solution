import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "@smartbusiness/auth";
import type { PermissionAction } from "../shared/constants/rbac.js";
import { AuditService } from "../shared/services/audit.service.js";

const auditService = new AuditService();

// Records the refusal and stops the request. Shared by both guards so a refusal
// looks the same in the audit log whichever rule refused it.
function deny(req: Request, required: PermissionAction[], missing: PermissionAction[], rule: "all" | "any"): never {
  auditService.log({
    tenantId: req.tenant!.tenantId,
    userId: req.user!.userId,
    workspaceId: req.workspace?.workspaceId,
    action: "ACCESS_DENIED",
    entityType: "Permission",
    entityId: req.user!.userId,
    details: {
      required,
      rule,
      missing,
      url: req.originalUrl,
      method: req.method,
    },
    ipAddress: req.ip,
  });

  throw new ForbiddenError("You do not have permission to perform this action");
}

/** Allows the request only if the user holds EVERY listed permission. */
export function requirePermission(...actions: PermissionAction[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPermissions = req.permissions ?? [];
    const missing = actions.filter((a) => !userPermissions.includes(a));

    if (missing.length > 0) deny(req, actions, missing, "all");

    next();
  };
}

/**
 * Allows the request if the user holds AT LEAST ONE listed permission.
 * Used where a capability follows from different jobs, e.g. viewing bank
 * accounts is needed both to manage them and to write checks against them.
 */
export function requireAnyPermission(...actions: PermissionAction[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPermissions = req.permissions ?? [];

    if (!actions.some((a) => userPermissions.includes(a))) deny(req, actions, actions, "any");

    next();
  };
}
