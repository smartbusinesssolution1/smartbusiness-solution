import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../shared/errors/index.js";
import { AuditService } from "../shared/services/audit.service.js";

const auditService = new AuditService();

// Company-level powers belong to the company owner, not to every workspace admin:
// opening a new workspace (its creator becomes its admin, with bank accounts and printing),
// sign-in history, resetting someone's two-factor sign-in.
//
// The role is req.tenant.role, which tenantMiddleware re-reads on every request, so a
// change of owner applies at once. A refusal is recorded like every other one.
export async function requireCompanyOwner(req: Request, _res: Response, next: NextFunction) {
  if (req.tenant?.role !== "OWNER") {
    await auditService.log({
      tenantId: req.tenant!.tenantId,
      userId: req.user!.userId,
      workspaceId: req.workspace?.workspaceId,
      action: "ACCESS_DENIED",
      entityType: "Permission",
      entityId: req.user!.userId,
      details: { reason: "NOT_COMPANY_OWNER", required: "company owner", url: req.originalUrl, method: req.method },
      ipAddress: req.ip,
    });
    throw new ForbiddenError("Only the company owner can do this.");
  }
  next();
}
