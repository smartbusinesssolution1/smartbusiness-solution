import { prisma, Tenant, User, Session } from "@smartbusiness/database";

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

export interface UserWithTenant extends User {
  tenant: Tenant;
}

export class AuthRepository {
  async findUserByEmail(email: string): Promise<UserWithTenant | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { tenant: true },
    });
  }

  async createUserWithTenant(data: CreateUserWithTenantData): Promise<UserWithTenant> {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.companyName,
          email: data.email,
        },
      });

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email,
          fullName: data.fullName,
          passwordHash: data.passwordHash,
        },
        include: { tenant: true },
      });
    });
  }

  async updateLastLogin(userId: string, tenantId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, tenantId, deletedAt: null },
      data: { lastLoginAt: new Date() },
    });
  }

  async findUserById(userId: string, tenantId: string): Promise<UserWithTenant | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: { tenant: true },
    });
  }

  // ─── Session Operations ─────────────────────────────────────────

  async createSession(data: CreateSessionData): Promise<Session> {
    return prisma.session.create({ data });
  }

  async findActiveSessionByTokenHash(tokenHash: string): Promise<(Session & { user: UserWithTenant }) | null> {
    return prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { tenant: true } },
      },
    }) as Promise<(Session & { user: UserWithTenant }) | null>;
  }

  async rotateSessionToken(sessionId: string, newTokenHash: string, newExpiresAt: Date): Promise<Session> {
    return prisma.session.update({
      where: { id: sessionId },
      data: {
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
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
