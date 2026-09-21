import { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { server, refreshToken as refreshTokenConfig } from "../../config/index.js";
import { sendCreated, sendSuccess } from "../../shared/utils/response.js";
import { AuthError } from "../../shared/errors/index.js";
import { type RegisterInputType, type LoginInputType } from "./auth.schema.js";

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;

const REFRESH_TOKEN_MAX_AGE = refreshTokenConfig.expiresDays * 24 * 60 * 60 * 1000;

const COOKIE_BASE = {
  httpOnly: true,
  secure: !server.isDev,
  sameSite: "strict" as const,
};

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(req.body as RegisterInputType, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendCreated(res, { user: result.user });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(req.body as LoginInputType, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    sendSuccess(res, { user: result.user });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (!rawRefreshToken) {
      throw new AuthError("Refresh token is required.");
    }

    const tokens = await this.authService.refresh(rawRefreshToken);

    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    sendSuccess(res, { message: "Tokens refreshed successfully." });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken, req.user!.userId, req.user!.tenantId);
    }

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "Logged out successfully." });
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logoutAll(req.user!.userId, req.user!.tenantId);

    this.clearAuthCookies(res);
    sendSuccess(res, { message: "All sessions revoked." });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.getCurrentUser(req.user!.userId, req.user!.tenantId);
    sendSuccess(res, { user });
  };

  // ─── Cookie Helpers ──────────────────────────────────────────

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie("access_token", accessToken, {
      ...COOKIE_BASE,
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: "/api",
    });

    res.cookie("refresh_token", refreshToken, {
      ...COOKIE_BASE,
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: "/api/v1/auth",
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie("access_token", {
      ...COOKIE_BASE,
      path: "/api",
    });

    res.clearCookie("refresh_token", {
      ...COOKIE_BASE,
      path: "/api/v1/auth",
    });
  }
}
