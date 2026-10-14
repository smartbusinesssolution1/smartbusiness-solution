import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../shared/errors/index.js";

/**
 * Middleware that restricts route access to organization Admins and Owners.
 * Requires tenantMiddleware to have already executed and populated req.tenant.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const role = req.tenant?.role;

  if (!role || (role !== "ADMIN" && role !== "OWNER")) {
    throw new ForbiddenError("Admin access required. You do not have permission to access this resource.");
  }

  next();
}
