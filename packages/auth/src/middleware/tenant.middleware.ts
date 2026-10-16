import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { AuthError, ForbiddenError } from "../errors/index.js";

export async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = req.headers["x-tenant-id"];

  if (!tenantId || typeof tenantId !== "string") {
    throw new AuthError("X-Tenant-Id header is required.");
  }

  const membership = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      userId: req.user!.userId,
      deletedAt: null,
    },
    include: { tenant: true, user: { select: { isActive: true, deletedAt: true } } },
  });

  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization.");
  }

  // Login tokens are checked by signature only and stay valid until they expire (15 min).
  // Re-reading the user here, with the membership already being loaded, ends access the
  // moment an account is deactivated or deleted instead of when the token runs out.
  if (!membership.user.isActive || membership.user.deletedAt !== null) {
    throw new AuthError("Account has been deactivated.");
  }

  if (membership.tenant.status !== "ACTIVE") {
    throw new ForbiddenError("This organization has been suspended.");
  }

  req.tenant = {
    tenantId: membership.tenant.id,
    role: membership.role,
  };

  next();
}
