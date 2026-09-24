import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "@smartbusiness/auth";
import { AuditService } from "../shared/services/audit.service.js";

const auditService = new AuditService();

export function requireSuperUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.permissions?.isSuperUser) {
    auditService.log({
      tenantId: req.tenant!.tenantId,
      userId: req.user!.userId,
      action: "ACCESS_DENIED",
      entityType: "Auth",
      entityId: req.user!.userId,
      details: {
        reason: "NOT_SUPER_USER",
        url: req.originalUrl,
        method: req.method,
      },
      ipAddress: req.ip,
    });
    throw new ForbiddenError("This action requires Super User permission");
  }
  next();
}

export function requirePermission(
  permission: "canCreate" | "canPrint" | "canApprove",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions?.[permission]) {
      auditService.log({
        tenantId: req.tenant!.tenantId,
        userId: req.user!.userId,
        action: "ACCESS_DENIED",
        entityType: "Auth",
        entityId: req.user!.userId,
        details: {
          reason: "MISSING_PERMISSION",
          permission,
          url: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.ip,
      });
      throw new ForbiddenError(
        `This action requires ${permission} permission`,
      );
    }
    next();
  };
}
