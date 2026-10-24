import type { Request, Response } from "express";
import type { TypedQueue, EmailJobs } from "@smartbusiness/jobs";
import type { AuthService } from "./auth.service.js";
import type {
  AcceptInvitationInput,
  ForgotPasswordInput,
  InvitationTokenInput,
  LoginInputType,
  RegisterInputType,
  ResetPasswordInput,
} from "./auth.schema.js";
import { sendCreated, sendSuccess } from "../../shared/utils/response.js";
import { AppError, AuthError } from "@smartbusiness/auth";
import {
  getAccessCookieOptions,
  getRefreshCookieOptions,
  getCookieBase,
  type CookieConfig,
} from "@smartbusiness/auth";
import {
  server,
  cookie,
  refreshToken as refreshTokenConfig,
} from "../../config/index.js";
import { logger } from "../../shared/services/logger.js";

export class AuthController {
  private cookieConfig: CookieConfig;

  constructor(
    private authService: AuthService,
    private emailQueue: TypedQueue<EmailJobs>,
  ) {
    this.cookieConfig = {
      isDev: server.isDev,
      cookieDomain: cookie.domain,
      refreshTokenMaxAge: refreshTokenConfig.expiresDays * 24 * 60 * 60 * 1000,
    };
  }

  private isAppPlatform(req: Request): boolean {
    const platformHeader = (req.headers["platform"] ||
      req.headers["x-platform"]) as string | undefined;
    return (
      platformHeader?.toLowerCase() === "app" ||
      (req.body as any)?.platform === "app"
    );
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(
      req.body as RegisterInputType,
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
    );

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    if (this.isAppPlatform(req)) {
      sendCreated(res, {
        user: result.user,
        tenants: result.tenants,
        tokens: result.tokens,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } else {
      sendCreated(res, { user: result.user, tenants: result.tenants });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(req.body as LoginInputType, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    if (this.isAppPlatform(req)) {
      sendSuccess(res, {
        user: result.user,
        tenants: result.tenants,
        tokens: result.tokens,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } else {
      sendSuccess(res, { user: result.user, tenants: result.tenants });
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken =
      req.cookies?.refresh_token || req.body?.refreshToken;

    if (!rawRefreshToken) {
      throw new AuthError("Refresh token is required.");
    }

    const result = await this.authService.refresh(rawRefreshToken);

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    if (this.isAppPlatform(req) || req.body?.refreshToken) {
      sendSuccess(res, {
        user: result.user,
        tenants: result.tenants,
        tokens: result.tokens,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } else {
      sendSuccess(res, { user: result.user, tenants: result.tenants });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken =
      req.cookies?.refresh_token || req.body?.refreshToken;

    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "Logged out successfully." });
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logoutAll(req.user!.userId);

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "All sessions revoked." });
  };

  // Adds a job for EVERY email, known or not, and replies the same way: the request
  // does no lookup, so neither the answer nor its timing reveals whether the account
  // exists. The worker does the real work, with retries.
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as ForgotPasswordInput;

    try {
      await this.emailQueue.add("password-reset", { email, ipAddress: req.ip });
    } catch (err) {
      // Happens equally for every email, so saying so reveals nothing.
      logger.error({ err }, "Could not queue a password reset");
      throw new AppError(
        "We couldn't start the reset right now. Try again in a moment.",
        503,
        "SERVICE_UNAVAILABLE",
      );
    }

    sendSuccess(
      res,
      {
        message:
          "If an account exists for that email, we've sent a link to reset the password.",
      },
      202,
    );
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body as ResetPasswordInput;

    await this.authService.resetPassword(token, password, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Every session was ended; clear this browser's cookies too.
    this.clearAuthCookies(res);
    sendSuccess(res, {
      message:
        "Your password has been changed. Sign in with your new password.",
    });
  };

  inspectInvitation = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as InvitationTokenInput;
    sendSuccess(res, await this.authService.inspectInvitation(token));
  };

  // Accepting signs the person in: the session goes into httpOnly cookies, never the body.
  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    const { token, fullName, password } = req.body as AcceptInvitationInput;
    const result = await this.authService.acceptInvitation(
      token,
      { fullName, password },
      {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    );

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );
    sendSuccess(res, {
      user: result.user,
      tenants: result.tenants,
      tenantId: result.tenantId,
      workspaceId: result.workspaceId,
    });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.getCurrentUser(req.user!.userId);
    sendSuccess(res, result);
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.updateProfile(
      req.user!.userId,
      req.body,
    );
    sendSuccess(res, {
      user: result,
      message: "Profile updated successfully.",
    });
  };

  // ─── Cookie Helpers ──────────────────────────────────────────

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(
      "access_token",
      accessToken,
      getAccessCookieOptions(this.cookieConfig),
    );
    res.cookie(
      "refresh_token",
      refreshToken,
      getRefreshCookieOptions(this.cookieConfig),
    );
  }

  private clearAuthCookies(res: Response): void {
    const base = getCookieBase(this.cookieConfig);

    res.clearCookie("access_token", { ...base, path: "/api" });
    res.clearCookie("refresh_token", { ...base, path: "/api/v1/auth" });
  }
}
