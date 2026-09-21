import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../shared/errors/index.js";

export function requireSuperUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.permissions?.isSuperUser) {
    throw new ForbiddenError("This action requires Super User permission");
  }
  next();
}

export function requirePermission(permission: "canCreate" | "canPrint" | "canApprove") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions?.[permission]) {
      throw new ForbiddenError(`This action requires ${permission} permission`);
    }
    next();
  };
}
