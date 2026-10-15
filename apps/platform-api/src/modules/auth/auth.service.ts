import {
  AuthRepository,
  type TenantInfo,
  type UserWithTenants,
} from "./auth.repository.js";
import type { LoginInputType, RegisterInputType } from "./auth.schema.js";
import { AuthError } from "@smartbusiness/auth";
import { AppError, ConflictError } from "../../shared/errors/index.js";
import { TokenService, PasswordService, UserTokenService, type TokenProblem } from "@smartbusiness/auth";
import { passwordChangedEmail, passwordResetEmail, type EmailSender } from "@smartbusiness/email";
import { AuditService } from "../../shared/services/audit.service.js";
import { refreshToken as refreshTokenConfig } from "../../config/index.js";
import { logger } from "../../shared/services/logger.js";

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tenants: TenantInfo[];
  tokens: AuthTokens;
}

interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetSettings {
  appUrl: string;
  ttlMinutes: number;
}

// At most one reset email per account per minute, whatever the request rate
// (stops "email bombing" a victim's inbox through our form).
const RESET_EMAIL_COOLDOWN_MS = 60 * 1000;

// Someone holding a reset link already has the email, so the reason a link fails
// reveals nothing to an attacker; it tells the owner what to do next.
const RESET_LINK_ERRORS: Record<TokenProblem, { code: string; message: string }> = {
  NOT_FOUND: { code: "INVALID_RESET_LINK", message: "This reset link is invalid. Request a new one." },
  EXPIRED: { code: "RESET_LINK_EXPIRED", message: "This link has expired. Request a new one." },
  USED: {
    code: "RESET_LINK_USED",
    message: "This link was already used. Request a new one if you still need to reset your password.",
  },
  REVOKED: { code: "RESET_LINK_REPLACED", message: "A newer reset link was sent. Use the link in the most recent email." },
};

function resetLinkError(problem: TokenProblem): AppError {
  const e = RESET_LINK_ERRORS[problem];
  return new AppError(e.message, 400, e.code);
}

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private auditService: AuditService,
    private userTokens: UserTokenService,
    private emailSender: EmailSender,
    private resetSettings: PasswordResetSettings,
  ) {}

  // ═════════════════════════════════════════════════════════════
  // FORGOT PASSWORD (runs in the job worker)
  //
  // The request only adds a job, the same way for every email, so the reply never
  // depends on whether the account exists. Every "no" here is silent. Safe to run
  // again: a retry issues a fresh link, which revokes any earlier unsent one.
  // ═════════════════════════════════════════════════════════════

  async processPasswordResetJob(email: string, opts: { isRetry: boolean; ipAddress?: string }): Promise<void> {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user || !user.isActive) return;

    // "Was a link sent in the last minute? If not, issue one" must be atomic: as two
    // separate steps, simultaneous requests would all see "no" and all send an email.
    // Locking the user's row makes them take turns.
    const token = await this.authRepository.transaction(async (tx) => {
      await this.authRepository.lockUser(user.id, tx);
      const since = new Date(Date.now() - RESET_EMAIL_COOLDOWN_MS);
      if (!opts.isRetry && (await this.authRepository.hasTokenIssuedSince(user.id, "PASSWORD_RESET", since, tx))) {
        return null;
      }

      const issued = await this.userTokens.issue(
        { userId: user.id, purpose: "PASSWORD_RESET", ttlMs: this.resetSettings.ttlMinutes * 60 * 1000 },
        tx,
      );
      return issued.token;
    });

    if (!token) {
      logger.info({ userId: user.id, action: "PASSWORD_RESET_THROTTLED" }, "Reset email already sent in the last minute");
      return;
    }

    // Built from configuration only: never from the request's Host header.
    const resetUrl = `${this.resetSettings.appUrl}/reset-password?token=${token}`;
    // If sending fails, this throws and the queue retries the whole job later.
    await this.emailSender.send({
      to: user.email,
      ...passwordResetEmail({ name: user.fullName, resetUrl, expiresInMinutes: this.resetSettings.ttlMinutes }),
    });

    await this.auditForUser(user, "PASSWORD_RESET_REQUESTED", opts.ipAddress);
  }

  // ═════════════════════════════════════════════════════════════
  // RESET PASSWORD
  //
  // One transaction: the link is used up, the password replaced, every session
  // ended and other links cancelled, together or not at all. If anything fails,
  // the link still works for a retry.
  // ═════════════════════════════════════════════════════════════

  async resetPassword(token: string, newPassword: string, ctx: SessionContext): Promise<void> {
    // Argon2 is deliberately slow; hashing before the transaction keeps the
    // transaction (and its row locks) short.
    const passwordHash = await this.passwordService.hash(newPassword);

    const user = await this.authRepository.transaction(async (tx) => {
      const check = await this.userTokens.consume(token, "PASSWORD_RESET", tx);
      if (!check.ok) throw resetLinkError(check.problem);

      // Deactivated or deleted since the link was sent: refuse (and roll back the consume).
      const user = await this.authRepository.findActiveUserById(check.record.userId, tx);
      if (!user) throw resetLinkError("NOT_FOUND");

      await this.authRepository.completePasswordReset(user.id, passwordHash, tx);
      return user;
    });

    const full = await this.authRepository.findUserById(user.id);
    if (full) await this.auditForUser(full, "PASSWORD_RESET", ctx.ipAddress);

    // The change is done; a failed notification must not undo or hide it.
    try {
      await this.emailSender.send({
        to: user.email,
        ...passwordChangedEmail({ name: user.fullName, changedAt: new Date() }),
      });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to send password-changed email");
    }
  }

  async register(
    data: RegisterInputType,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const existing = await this.authRepository.findUserByEmail(data.email);
    if (existing) {
      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await this.passwordService.hash(data.password);

    const user = await this.authRepository.createUserWithTenant({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      companyName: data.companyName,
    });
    if (!user) {
      throw new ConflictError("An account with this email already exists.");
    }

    const tenants = this.extractTenants(user);
    const primaryTenant = tenants[0]!;

    const tokens = await this.createSession(user.id, user.email, ctx);

    await this.auditService.log({
      tenantId: primaryTenant.tenantId,
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      details: { email: user.email },
      ipAddress: ctx.ipAddress,
    });

    return {
      user: { id: user.id, fullName: user.fullName, email: user.email },
      tenants,
      tokens,
    };
  }

  async login(data: LoginInputType, ctx: SessionContext): Promise<AuthResult> {
    const user = await this.authRepository.findUserByEmail(data.email);

    if (!user) {
      // Hash anyway so an unknown email takes as long as a wrong password.
      await this.passwordService.hash(data.password);
      logger.warn(
        { ipAddress: ctx.ipAddress, action: "LOGIN_FAILED" },
        "Login attempt for nonexistent email",
      );
      throw new AuthError("Invalid email or password.");
    }

    // The password is checked FIRST. Only someone who knows it may learn anything
    // about the account (deactivated, no active organization); anyone else gets the
    // same answer as for an unknown email, so accounts cannot be discovered.
    const isValidPassword = await this.passwordMatches(data.password, user.passwordHash);
    if (!isValidPassword) {
      const anyTenantId = user.tenantMembers[0]?.tenant.id;
      if (anyTenantId) {
        await this.auditService.log({
          tenantId: anyTenantId,
          userId: user.id,
          action: "LOGIN_FAILED",
          entityType: "Auth",
          entityId: user.id,
          details: { reason: "INVALID_PASSWORD" },
          ipAddress: ctx.ipAddress,
        });
      }
      throw new AuthError("Invalid email or password.");
    }

    if (!user.isActive) {
      logger.warn(
        { userId: user.id, action: "LOGIN_FAILED_INACTIVE" },
        "Login attempt for deactivated account",
      );
      throw new AuthError("Account has been deactivated.");
    }

    const activeTenants = this.extractTenants(user);

    if (activeTenants.length === 0) {
      logger.warn(
        { userId: user.id, action: "LOGIN_FAILED_NO_TENANT" },
        "Login attempt with no active tenant memberships",
      );
      throw new AuthError("No active organization found for this account.");
    }

    await this.authRepository.updateLastLogin(user.id);

    const tokens = await this.createSession(user.id, user.email, ctx);

    const auditTenant = activeTenants[0]!;
    await this.auditService.log({
      tenantId: auditTenant.tenantId,
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "Session",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return {
      user: { id: user.id, fullName: user.fullName, email: user.email },
      tenants: activeTenants,
      tokens,
    };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    const session =
      await this.authRepository.findActiveSessionByTokenHash(tokenHash);

    if (!session) {
      logger.warn(
        { action: "REFRESH_FAILED" },
        "Refresh attempt with invalid/expired token",
      );
      throw new AuthError("Invalid or expired refresh token.");
    }

    if (!session.user.isActive) {
      await this.authRepository.revokeSession(session.id);
      throw new AuthError("Account has been deactivated.");
    }

    const activeTenants = this.extractTenants(session.user);

    if (activeTenants.length === 0) {
      await this.authRepository.revokeSession(session.id);
      throw new AuthError("No active organization found for this account.");
    }

    const newRefresh = this.tokenService.generateRefreshToken();
    const newExpiry = this.computeRefreshExpiry();

    await this.authRepository.rotateSessionToken(
      session.id,
      newRefresh.hash,
      newExpiry,
    );

    const accessToken = this.tokenService.generateAccessToken({
      userId: session.userId,
      email: session.user.email,
    });

    return {
      user: {
        id: session.user.id,
        fullName: session.user.fullName,
        email: session.user.email,
      },
      tenants: activeTenants,
      tokens: { accessToken, refreshToken: newRefresh.raw },
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session =
      await this.authRepository.findActiveSessionByTokenHash(tokenHash);

    if (session) {
      await this.authRepository.revokeSession(session.id);

      const tenants = this.extractTenants(session.user);
      const auditTenantId = tenants[0]?.tenantId ?? "unknown";

      await this.auditService.log({
        tenantId: auditTenantId,
        userId: session.userId,
        action: "USER_LOGOUT",
        entityType: "Session",
        entityId: session.id,
      });
    }
  }

  async logoutAll(userId: string): Promise<void> {
    const user = await this.authRepository.findUserById(userId);
    await this.authRepository.revokeAllUserSessions(userId);

    const tenants = user ? this.extractTenants(user) : [];
    const auditTenantId = tenants[0]?.tenantId ?? "unknown";

    await this.auditService.log({
      tenantId: auditTenantId,
      userId,
      action: "ALL_SESSIONS_REVOKED",
      entityType: "User",
      entityId: userId,
    });
  }

  async getCurrentUser(userId: string): Promise<{
    user: AuthUser;
    tenants: TenantInfo[];
  } | null> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) return null;

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      tenants: this.extractTenants(user),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────

  // Audit rows belong to a tenant; a user with no membership at all is logged instead.
  private async auditForUser(user: UserWithTenants, action: string, ipAddress?: string): Promise<void> {
    const tenantId = user.tenantMembers[0]?.tenant.id;
    if (!tenantId) {
      logger.info({ userId: user.id, action }, "Audit event for a user without a tenant");
      return;
    }
    await this.auditService.log({ tenantId, userId: user.id, action, entityType: "User", entityId: user.id, ipAddress });
  }

  // An invited user who has not accepted yet has no password (null). Refuse them exactly
  // like a wrong password, after the same hashing work, so neither the answer nor the
  // response time reveals that the account exists.
  private async passwordMatches(password: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) {
      await this.passwordService.hash(password);
      return false;
    }
    return this.passwordService.verify(password, storedHash);
  }

  private extractTenants(user: UserWithTenants): TenantInfo[] {
    return user.tenantMembers
      .filter((tm) => tm.tenant.status === "ACTIVE")
      .map((tm) => ({
        tenantId: tm.tenant.id,
        tenantName: tm.tenant.name,
        role: tm.role,
        status: tm.tenant.status,
      }));
  }

  private async createSession(
    userId: string,
    email: string,
    ctx: SessionContext,
  ): Promise<AuthTokens> {
    const activeCount = await this.authRepository.countActiveSessions(userId);
    if (activeCount >= refreshTokenConfig.maxSessionsPerUser) {
      await this.authRepository.revokeOldestSession(userId);
    }

    const refresh = this.tokenService.generateRefreshToken();
    const expiresAt = this.computeRefreshExpiry();

    await this.authRepository.createSession({
      userId,
      tokenHash: refresh.hash,
      expiresAt,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const accessToken = this.tokenService.generateAccessToken({
      userId,
      email,
    });

    return { accessToken, refreshToken: refresh.raw };
  }

  private computeRefreshExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + refreshTokenConfig.expiresDays);
    return expiry;
  }
}
