import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { AuthError, ForbiddenError } from "../errors/index.js";
import { SimpleCache } from "../utils/cache.js";

interface CachedTenantMember {
  tenantId: string;
  role: any;
  tenantStatus: string;
}

export const tenantMemberCache = new SimpleCache<CachedTenantMember>(60);

export async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = req.headers["x-tenant-id"];

  if (!tenantId || typeof tenantId !== "string") {
    throw new AuthError("X-Tenant-Id header is required.");
  }

  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthError("Authentication required.");
  }

  const cacheKey = `${tenantId}:${userId}`;
  const cached = tenantMemberCache.get(cacheKey);

  if (cached) {
    if (cached.tenantStatus !== "ACTIVE") {
      throw new ForbiddenError("This organization has been suspended.");
    }
    req.tenant = {
      tenantId: cached.tenantId,
      role: cached.role,
    };
    return next();
  }

  const membership = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
    },
    include: { tenant: true },
  });

  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization.");
  }

  if (membership.tenant.status !== "ACTIVE") {
    throw new ForbiddenError("This organization has been suspended.");
  }

  tenantMemberCache.set(cacheKey, {
    tenantId: membership.tenant.id,
    role: membership.role,
    tenantStatus: membership.tenant.status,
  });

  req.tenant = {
    tenantId: membership.tenant.id,
    role: membership.role,
  };

  next();
}

