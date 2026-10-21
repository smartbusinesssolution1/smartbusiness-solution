import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { AuthError, ForbiddenError } from "../errors/index.js";

interface MembershipRow {
  tenant_id: string;
  role: string;
  tenant_status: string;
  user_active: boolean;
  user_deleted: boolean;
}

// Every request re-reads the membership, the account and the organization, so access ends
// on the very next request when someone is deactivated, removed from the organization,
// demoted (Clock-In's admin rights come from this role) or their organization is suspended.
// Nothing here may be cached: a cached answer would skip exactly these checks.
//
// One SQL round trip with joins (the Prisma include it replaces made three), served by the
// (tenant_id, user_id, deleted_at) index on tenant_members.
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

  const [membership] = await prisma.$queryRaw<MembershipRow[]>`
    SELECT tm.tenant_id,
           tm.role::text                AS role,
           t.status::text               AS tenant_status,
           u.is_active                  AS user_active,
           (u.deleted_at IS NOT NULL)   AS user_deleted
    FROM tenant_members tm
    JOIN tenants t ON t.id = tm.tenant_id
    JOIN users   u ON u.id = tm.user_id
    WHERE tm.tenant_id = ${tenantId}
      AND tm.user_id = ${userId}
      AND tm.deleted_at IS NULL
    LIMIT 1`;

  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization.");
  }

  // Login tokens are checked by signature only and stay valid until they expire (15 min).
  // Re-reading the user here ends access the moment an account is deactivated or deleted
  // instead of when the token runs out.
  if (!membership.user_active || membership.user_deleted) {
    throw new AuthError("Account has been deactivated.");
  }

  if (membership.tenant_status !== "ACTIVE") {
    throw new ForbiddenError("This organization has been suspended.");
  }

  req.tenant = {
    tenantId: membership.tenant_id,
    role: membership.role,
  };

  next();
}
