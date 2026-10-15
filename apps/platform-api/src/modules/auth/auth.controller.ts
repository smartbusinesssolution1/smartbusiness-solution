import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import {
  AuthError,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  getCookieBase,
  type CookieConfig,
} from "@smartbusiness/auth";
import { server, cookie, refreshToken as refreshTokenConfig } from "../../config/index.js";
import { sendCreated, sendSuccess } from "../../shared/utils/response.js";
import type { RegisterInputType, LoginInputType, ForgotPasswordInput, ResetPasswordInput } from "./auth.schema.js";
import { runInBackground } from "../../shared/services/background.js";

export class AuthController {
  private cookieConfig: CookieConfig;

  constructor(private authService: AuthService) {
    this.cookieConfig = {
      isDev: server.isDev,
      cookieDomain: cookie.domain,
      refreshTokenMaxAge:
        refreshTokenConfig.expiresDays * 24 * 60 * 60 * 1000,
    };
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(
      req.body as RegisterInputType,
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
    );

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendCreated(res, { user: result.user, tenants: result.tenants });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(
      req.body as LoginInputType,
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
    );

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendSuccess(res, { user: result.user, tenants: result.tenants });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (!rawRefreshToken) {
      throw new AuthError("Refresh token is required.");
    }

    const result = await this.authService.refresh(rawRefreshToken);

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendSuccess(res, { user: result.user, tenants: result.tenants });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

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

  // Replies at once, the same way for every email, and only then does the work: an
  // account that exists must not answer slower (or differently) than one that does not.
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as ForgotPasswordInput;

    sendSuccess(
      res,
      { message: "If an account exists for that email, we've sent a link to reset the password." },
      202,
    );

    runInBackground("password-reset-request", () =>
      this.authService.requestPasswordReset(email, { ipAddress: req.ip, userAgent: req.headers["user-agent"] }),
    );
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body as ResetPasswordInput;

    await this.authService.resetPassword(token, password, { ipAddress: req.ip, userAgent: req.headers["user-agent"] });

    // Every session was ended; clear this browser's cookies too.
    this.clearAuthCookies(res);
    sendSuccess(res, { message: "Your password has been changed. Sign in with your new password." });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.getCurrentUser(req.user!.userId);
    sendSuccess(res, result);
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
