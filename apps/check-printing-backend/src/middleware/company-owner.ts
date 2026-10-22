import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../shared/errors/index.js";

// Company-level powers (sign-in history, resetting someone's two-factor sign-in) belong to
// the company owner, not to every workspace admin.
export function requireCompanyOwner(req: Request, _res: Response, next: NextFunction) {
  if (req.tenant?.role !== "OWNER") throw new ForbiddenError("Only the company owner can do this.");
  next();
}
