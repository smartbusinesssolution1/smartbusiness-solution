import type { Request, Response } from "express";
import type { TypedQueue, EmailJobs } from "@smartbusiness/jobs";
import type { AuthService } from "./auth.service.js";
import type {
  ForgotPasswordInput,
  LoginInputType,
  RegisterInputType,
  ResetPasswordInput,
  AcceptInvitationInput,
  InvitationTokenInput,
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
import { isAllowedOrigin } from "../../shared/utils/allowed-origin.js";

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

  // Whether the request comes from a web browser. Browsers add Origin (on every POST) and
  // Sec-Fetch-Site themselves, and page JavaScript can neither remove nor fake them; a
  // mobile app's HTTP client sends neither. Unlike the "platform" header, which any script
  // on our website could set, this can't be pretended.
  private fromBrowser(req: Request): boolean {
    return Boolean(req.headers.origin || req.headers["sec-fetch-site"]);
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

    await this.queueWelcomeEmail(result.user.id, this.ourAppUrl(req));

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

  // The welcome email goes through the job queue like every other email: retried if
  // sending fails, and sign-up doesn't wait for the mail server. The job holds only the
  // user's id and app address, never the password. One job per user (the job id), so a
  // repeated request can't send two. If the queue is unreachable the account still
  // exists and works; only the welcome email is missing, so this never fails sign-up.
  private async queueWelcomeEmail(userId: string, appUrl: string | undefined): Promise<void> {
    try {
      await this.emailQueue.add("welcome-email", { userId, appUrl }, { jobId: `welcome-${userId}` });
    } catch (err) {
      logger.warn({ err: (err as Error)?.message, userId }, "Could not queue the welcome email; the account was created");
    }
  }

  // Which of OUR apps a link in an email should open (the portal for a sign-up, Clock-In
  // for a Clock-In user's reset): from redirectUrl, Origin or Referer, but only if it is
  // one of our websites, by the same rule as CORS. Anyone can send any value here;
  // accepting other addresses would put a genuine link to someone else's site (or a laptop
  // on the office network) into our emails. undefined: use the configured APP_URL.
  private ourAppUrl(req: Request, redirectUrl?: string): string | undefined {
    try {
      const candidate = redirectUrl || (req.headers.origin as string) || (req.headers.referer as string);
      if (!candidate) return undefined;
      const origin = new URL(candidate).origin;
      return isAllowedOrigin(origin) ? origin : undefined;
    } catch {
      // Not a URL (a malformed Referer, say).
      return undefined;
    }
  }

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
    // A mobile app keeps its refresh token itself and sends it in the body; a browser's is
    // in the httpOnly cookie. When both arrive, the body's is the one used.
    const bodyToken =
      typeof req.body?.refreshToken === "string" && req.body.refreshToken
        ? (req.body.refreshToken as string)
        : undefined;
    const rawRefreshToken = bodyToken ?? req.cookies?.refresh_token;

    if (!rawRefreshToken) {
      throw new AuthError("Refresh token is required.");
    }

    const result = await this.authService.refresh(rawRefreshToken);

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    // The new tokens go in the body only to a caller that already held its refresh token
    // (it sent it in the body), or to an app that isn't a web browser. Never to a web page
    // that only had the cookie: a script injected into our site could otherwise call this
    // with "x-platform: app" and walk away with a refresh token that works for days.
    if (bodyToken || (this.isAppPlatform(req) && !this.fromBrowser(req))) {
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
    const { email, redirectUrl } = req.body as ForgotPasswordInput;

    // Which app the reset link opens (so a Clock-In user lands on Clock-In): only ever one
    // of our own websites (see ourAppUrl), otherwise the configured APP_URL.
    const clientAppUrl = this.ourAppUrl(req, redirectUrl);

    try {
      await this.emailQueue.add("password-reset", { email, ipAddress: req.ip, appUrl: clientAppUrl });
    } catch (err) {
      logger.warn({ err: (err as any)?.message }, "Could not queue password reset to Redis, running directly as fallback");
      try {
        await this.authService.processPasswordResetJob(email, { isRetry: false, ipAddress: req.ip, appUrl: clientAppUrl });
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr }, "Direct password reset processing also failed");
      }
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
