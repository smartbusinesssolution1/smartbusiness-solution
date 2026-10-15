import {
  prisma,
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

export class AuthRepository {
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

  async createUserWithTenant(
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
