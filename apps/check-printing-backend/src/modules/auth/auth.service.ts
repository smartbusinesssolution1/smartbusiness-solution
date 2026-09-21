import { AuthRepository } from "./auth.repository.js";
import { LoginInputType, RegisterInputType } from "./auth.schema.js";
import { AuthError, ConflictError } from "../../shared/errors/index.js";
import { PasswordService } from "../../shared/services/password.service.js";
import { TokenService, type AccessTokenPayload } from "../../shared/services/token.service.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { refreshToken as refreshTokenConfig } from "../../config/index.js";

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  tenantId: string;
  tenantName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
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

  async register(data: RegisterInputType, ctx: SessionContext): Promise<AuthResult> {
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

    const tokens = await this.createSession(user.id, user.tenantId, user.email, ctx);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      details: { email: user.email },
      ipAddress: ctx.ipAddress,
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
      },
      tokens,
    };
  }

  async login(data: LoginInputType, ctx: SessionContext): Promise<AuthResult> {
    const user = await this.authRepository.findUserByEmail(data.email);

    if (!user) {
      await this.passwordService.hash(data.password);
      throw new AuthError("Invalid email or password.");
    }

    if (!user.isActive) {
      throw new AuthError("Account has been deactivated.");
    }

    if (user.tenant.status !== "ACTIVE") {
      throw new AuthError("Account has been suspended.");
    }

    const isValidPassword = await this.passwordService.verify(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthError("Invalid email or password.");
    }

    await this.authRepository.updateLastLogin(user.id, user.tenantId);

    const tokens = await this.createSession(user.id, user.tenantId, user.email, ctx);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "Session",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
      },
      tokens,
    };
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    const session = await this.authRepository.findActiveSessionByTokenHash(tokenHash);

    if (!session) {
      throw new AuthError("Invalid or expired refresh token.");
    }

    if (!session.user.isActive) {
      await this.authRepository.revokeSession(session.id);
      throw new AuthError("Account has been deactivated.");
    }

    if (session.user.tenant.status !== "ACTIVE") {
      await this.authRepository.revokeSession(session.id);
      throw new AuthError("Account has been suspended.");
    }

    const newRefresh = this.tokenService.generateRefreshToken();
    const newExpiry = this.computeRefreshExpiry();

    await this.authRepository.rotateSessionToken(session.id, newRefresh.hash, newExpiry);

    const accessToken = this.tokenService.generateAccessToken({
      userId: session.userId,
      tenantId: session.user.tenantId,
      email: session.user.email,
    });

    await this.auditService.log({
      tenantId: session.user.tenantId,
      userId: session.userId,
      action: "SESSION_REFRESHED",
      entityType: "Session",
      entityId: session.id,
    });

    return { accessToken, refreshToken: newRefresh.raw };
  }

  async logout(rawRefreshToken: string, userId?: string, tenantId?: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session = await this.authRepository.findActiveSessionByTokenHash(tokenHash);

    if (session) {
      await this.authRepository.revokeSession(session.id);

      await this.auditService.log({
        tenantId: tenantId ?? session.user.tenantId,
        userId: userId ?? session.userId,
        action: "USER_LOGOUT",
        entityType: "Session",
        entityId: session.id,
      });
    }
  }

  async logoutAll(userId: string, tenantId: string): Promise<void> {
    await this.authRepository.revokeAllUserSessions(userId);

    await this.auditService.log({
      tenantId,
      userId,
      action: "ALL_SESSIONS_REVOKED",
      entityType: "User",
      entityId: userId,
    });
  }

  async getCurrentUser(userId: string, tenantId: string): Promise<AuthUser | null> {
    const user = await this.authRepository.findUserById(userId, tenantId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private async createSession(
    userId: string,
    tenantId: string,
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
      tenantId,
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
