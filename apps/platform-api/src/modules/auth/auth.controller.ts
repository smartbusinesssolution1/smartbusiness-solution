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
import type { RegisterInputType, LoginInputType } from "./auth.schema.js";

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
    sendCreated(res, { user: result.user, tenants: result.tenants, tokens: result.tokens });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(
      req.body as LoginInputType,
      { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
    );

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendSuccess(res, { user: result.user, tenants: result.tenants, tokens: result.tokens });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (!rawRefreshToken) {
      throw new AuthError("Refresh token is required.");
    }

    const result = await this.authService.refresh(rawRefreshToken);

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendSuccess(res, { user: result.user, tenants: result.tenants, tokens: result.tokens });
  };


  logout = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken, req.user?.userId);
    }

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "Logged out successfully." });
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logoutAll(req.user!.userId);

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "All sessions revoked." });
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
