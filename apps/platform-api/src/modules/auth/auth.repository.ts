import {
  prisma,
  Prisma,
  type User,
  type Tenant,
  type TenantMember,
  type Session,
} from "@smartbusiness/database";

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

export interface UserWithTenants extends User {
  tenantMembers: (TenantMember & { tenant: Tenant })[];
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

  async findActiveUserById(userId: string, tx: Tx) {
    return tx.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true } });
  }

  // The database side of a password reset, inside the caller's transaction:
  // new password, email confirmed (they proved they own the inbox), every session
  // ended, and any other reset link or pending invitation cancelled.
  async completePasswordReset(userId: string, passwordHash: string, tx: Tx): Promise<void> {
    const now = new Date();
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
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

  // ─── Session Operations ─────────────────────────────────────────

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
