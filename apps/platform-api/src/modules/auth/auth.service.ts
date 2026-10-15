import {
  AuthRepository,
  type TenantInfo,
  type UserWithTenants,
} from "./auth.repository.js";
import type { LoginInputType, RegisterInputType } from "./auth.schema.js";
import { AuthError } from "@smartbusiness/auth";
import { ConflictError } from "../../shared/errors/index.js";
import { TokenService, PasswordService } from "@smartbusiness/auth";
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

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private auditService: AuditService,
  ) {}

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
