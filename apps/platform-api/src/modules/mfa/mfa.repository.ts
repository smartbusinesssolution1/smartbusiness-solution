import { prisma } from "@smartbusiness/database";

// Database side of two-factor sign-in. Every check that must be exact under concurrency
// (claiming a 30-second step, using a backup code) is one conditional UPDATE.

export class MfaRepository {
  async findUser(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        mfaSecretEncrypted: true,
        mfaPendingSecretEncrypted: true,
        mfaPendingCreatedAt: true,
        mfaEnabledAt: true,
        tenantMembers: { where: { deletedAt: null }, select: { tenantId: true }, take: 1 },
      },
    });
  }

  // The session this request belongs to, found from its refresh token (the refresh cookie
  // is sent to every /api/v1/auth path, /auth/mfa included), and only if it is this user's.
  async findSession(tokenHash: string, userId: string) {
    return prisma.session.findFirst({
      where: { tokenHash, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, mfaVerifiedAt: true },
    });
  }

  async savePendingSecret(userId: string, sealed: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaPendingSecretEncrypted: sealed, mfaPendingCreatedAt: new Date() },
    });
  }

  // Setup proved: the pending secret becomes the active one, the step just used can't be
  // used again, new backup codes replace any old ones, and this session counts as verified.
  async enable(userId: string, step: number, backupHashes: string[], sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaPendingSecretEncrypted: true } });
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
          mfaPendingCreatedAt: null,
          mfaEnabledAt: new Date(),
          mfaLastUsedStep: step,
          mfaFailedCount: 0,
          mfaLastFailedAt: null,
          mfaLockedUntil: null,
        },
      });
      await tx.mfaBackupCode.deleteMany({ where: { userId } });
      await tx.mfaBackupCode.createMany({ data: backupHashes.map((codeHash) => ({ userId, codeHash })) });
      await tx.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
    });
  }

  // A code is accepted at most once: the step must be later than the last one used. Two
  // requests with the same code at the same moment can't both win this UPDATE.
  async claimStep(userId: string, step: number): Promise<boolean> {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }] },
      data: { mfaLastUsedStep: step },
    });
    return count === 1;
  }

  // A backup code works once: the same exactly-once UPDATE.
  async useBackupCode(userId: string, codeHash: string): Promise<boolean> {
    const { count } = await prisma.mfaBackupCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }

  async unusedBackupCodes(userId: string): Promise<number> {
    return prisma.mfaBackupCode.count({ where: { userId, usedAt: null } });
  }

  async replaceBackupCodes(userId: string, backupHashes: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.mfaBackupCode.deleteMany({ where: { userId } }),
      prisma.mfaBackupCode.createMany({ data: backupHashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);
  }

  async markSessionVerified(sessionId: string): Promise<void> {
    await prisma.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
  }

  // Off: the secret, backup codes and attempt counts go, and no session counts as verified.
  async disable(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          mfaSecretEncrypted: null,
          mfaPendingSecretEncrypted: null,
          mfaPendingCreatedAt: null,
          mfaEnabledAt: null,
          mfaLastUsedStep: null,
          mfaFailedCount: 0,
          mfaLastFailedAt: null,
          mfaLockedUntil: null,
        },
      }),
      prisma.mfaBackupCode.deleteMany({ where: { userId } }),
      prisma.session.updateMany({ where: { userId, mfaVerifiedAt: { not: null } }, data: { mfaVerifiedAt: null } }),
    ]);
  }
}
