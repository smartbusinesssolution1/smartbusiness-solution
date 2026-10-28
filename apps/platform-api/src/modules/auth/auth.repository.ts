import {
  prisma,
  Prisma,
  type User,
  type Tenant,
  type TenantMember,
  type Session,
} from "@smartbusiness/database";
import { clearAttempts, lockedUntil, reserveAttempt, type Attempt } from "./attempts.js";

interface CreateUserWithTenantData {
  email: string;
  passwordHash: string;
  fullName: string;
  companyName: string;
}

interface CreateSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
}

// A product the company can open right now: the same rule the products' own APIs apply at
// their door (requireProduct in @smartbusiness/auth), so the portal never offers a product
// that would then refuse the user.
export interface TenantProduct {
  slug: string;
  name: string;
  status: string;
  trialEndsAt: Date | null;
}

export interface TenantInfoWithProducts extends TenantInfo {
  products: TenantProduct[];
}

export const PRODUCT_ACCESS_STATUSES = ["ACTIVE", "TRIALING"] as const;

export interface UserWithTenants extends User {
  tenantMembers: (TenantMember & { tenant: Tenant })[];
}

type SubscriptionWithProduct = {
  status: string;
  trialEndsAt: Date | null;
  product: { slug: string; name: string };
};

export interface UserWithTenantProducts extends User {
  tenantMembers: (TenantMember & { tenant: Tenant & { subscriptions: SubscriptionWithProduct[] } })[];
}

export interface SessionWithUser extends Session {
  user: UserWithTenants;
}

type Tx = Prisma.TransactionClient;

// Prisma's defaults are too short for a remote database under concurrent requests.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

export class AuthRepository {
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, TX_OPTIONS);
  }

  // True if a token of this purpose was issued to the user after `since`
  // (used to send at most one reset email per minute per account).
  async hasTokenIssuedSince(
    userId: string,
    purpose: "PASSWORD_RESET" | "INVITATION",
    since: Date,
    tx: Tx,
  ): Promise<boolean> {
    const count = await tx.userToken.count({ where: { userId, purpose, createdAt: { gt: since } } });
    return count > 0;
  }

  // Locks the user's row until the transaction ends, so concurrent requests for the
  // same account run one at a time (each one sees what the previous one wrote).
  async lockUser(userId: string, tx: Tx): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }

  // Everything an invitation email or the invitation page needs, read fresh: the invited
  // person, the workspace and its company, who invited them, and whether the access
  // still exists (an invitation cancelled after it was queued must send nothing).
  async findInvitationContext(userId: string, workspaceId: string, invitedById: string | null) {
    const [user, workspace, inviter, membership] = await Promise.all([
      prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true },
        select: { id: true, email: true, fullName: true, passwordHash: true },
      }),
      prisma.workspace.findFirst({
        where: { id: workspaceId, deletedAt: null },
        select: { id: true, businessName: true, tenantId: true, tenant: { select: { name: true, status: true } } },
      }),
      invitedById ? prisma.user.findUnique({ where: { id: invitedById }, select: { fullName: true } }) : null,
      prisma.workspaceMember.findFirst({ where: { workspaceId, userId, deletedAt: null }, select: { id: true } }),
    ]);
    return {
      user: user ? { id: user.id, email: user.email, fullName: user.fullName, hasPassword: user.passwordHash !== null } : null,
      workspace,
      inviterName: inviter?.fullName ?? null,
      membershipActive: membership !== null,
    };
  }

  async isActiveWorkspaceMember(workspaceId: string, userId: string, tx: Tx): Promise<boolean> {
    return (await tx.workspaceMember.count({ where: { workspaceId, userId, deletedAt: null } })) > 0;
  }

  // Accepting an invitation: the invited person chooses their password (and may correct
  // their name). Conditional on the account still having no password, so two accepts at
  // once cannot both set one. Opening the emailed link also confirms the email address.
  async setInvitedUserPassword(userId: string, passwordHash: string, fullName: string, tx: Tx): Promise<boolean> {
    const { count } = await tx.user.updateMany({
      where: { id: userId, passwordHash: null },
      data: { passwordHash, fullName, emailVerifiedAt: new Date(), failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
    return count === 1;
  }

  async findActiveUserById(userId: string, tx: Tx) {
    return tx.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true } });
  }

  // The database side of a password reset, inside the caller's transaction:
  // new password, email confirmed (they proved they own the inbox), every session
  // ended, and any other reset link or pending invitation cancelled.
  async completePasswordReset(userId: string, passwordHash: string, tx: Tx): Promise<void> {
    const now = new Date();
    // Resetting proves control of the inbox, so it also ends any lockout.
    await tx.user.update({ where: { id: userId }, data: { passwordHash, failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null } });
    await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.userToken.updateMany({
      where: { userId, purpose: { in: ["PASSWORD_RESET", "INVITATION"] }, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async findUserByEmail(email: string): Promise<UserWithTenants | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        tenantMembers: {
          where: { deletedAt: null },
          include: { tenant: true },
        },
      },
    }) as Promise<UserWithTenants | null>;
  }

  /**
   * Returns null when the email is already taken: the service's earlier lookup can't
   * see a sign-up for the same email that is committing at this very moment, but the
   * unique indexes on users.email and tenants.billing_email can.
   */
  async createUserWithTenant(
    data: CreateUserWithTenantData,
  ): Promise<UserWithTenants | null> {
    try {
      return await this.insertUserWithTenant(data);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return null;
      }
      throw err;
    }
  }

  private async insertUserWithTenant(
    data: CreateUserWithTenantData,
  ): Promise<UserWithTenants> {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.companyName,
          billingEmail: data.email,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          passwordHash: data.passwordHash,
        },
      });

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      const activeProducts = await tx.product.findMany({
        where: { isActive: true },
      });

      if (activeProducts.length > 0) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

        await tx.productSubscription.createMany({
          data: activeProducts.map((product) => ({
            tenantId: tenant.id,
            productId: product.id,
            plan: "TRIAL" as const,
            status: "TRIALING" as const,
            trialEndsAt,
          })),
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          tenantMembers: {
            where: { deletedAt: null },
            include: { tenant: true },
          },
        },
      }) as Promise<UserWithTenants>;
    });
  }

  // Account lockout lives in attempts.ts (shared with two-factor codes): see there.
  async reserveLoginAttempt(userId: string): Promise<Attempt> {
    return reserveAttempt(userId, "password");
  }

  async findLockedUntil(userId: string): Promise<Date | null> {
    return lockedUntil(userId, "password");
  }

  async clearLoginFailures(userId: string): Promise<void> {
    await clearAttempts(userId, "password");
  }

  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateUserProfile(userId: string, data: { fullName?: string }): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName ? { fullName: data.fullName } : {}),
      },
    });
  }

  async findUserById(userId: string): Promise<UserWithTenants | null> {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        tenantMembers: {
          where: { deletedAt: null },
          include: { tenant: true },
        },
      },
    }) as Promise<UserWithTenants | null>;
  }

  // The same user and companies, plus the products each company can open (for /me only:
  // sign-in and refresh don't need them and stay one query lighter).
  async findUserWithTenantProducts(userId: string): Promise<UserWithTenantProducts | null> {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        tenantMembers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              include: {
                subscriptions: {
                  where: { status: { in: [...PRODUCT_ACCESS_STATUSES] }, product: { isActive: true } },
                  select: { status: true, trialEndsAt: true, product: { select: { slug: true, name: true } } },
                  orderBy: { product: { name: "asc" } },
                },
              },
            },
          },
        },
      },
    }) as Promise<UserWithTenantProducts | null>;
  }

  // â”€â”€â”€ Session Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createSession(data: CreateSessionData): Promise<Session> {
    return prisma.session.create({ data });
  }

  async findActiveSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null> {
    return prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            tenantMembers: {
              where: { deletedAt: null },
              include: { tenant: true },
            },
          },
        },
      },
    }) as Promise<SessionWithUser | null>;
  }

  async rotateSessionToken(
    sessionId: string,
    newTokenHash: string,
    newExpiresAt: Date,
  ): Promise<Session> {
    return prisma.session.update({
      where: { id: sessionId },
      data: { tokenHash: newTokenHash, expiresAt: newExpiresAt },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async countActiveSessions(userId: string): Promise<number> {
    return prisma.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async revokeOldestSession(userId: string): Promise<void> {
    const oldest = await prisma.session.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "asc" },
    });

    if (oldest) {
      await this.revokeSession(oldest.id);
    }
  }
}
