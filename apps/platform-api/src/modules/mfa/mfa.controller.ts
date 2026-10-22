import type { Request, Response } from "express";
import { getAccessCookieOptions, type CookieConfig, type TokenService } from "@smartbusiness/auth";
import { cookie, refreshToken as refreshTokenConfig, server } from "../../config/index.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { MfaContext, MfaService } from "./mfa.service.js";
import type { MfaCodeInput, MfaDisableInput } from "./mfa.schema.js";

export class MfaController {
  private readonly cookieConfig: CookieConfig = {
    isDev: server.isDev,
    cookieDomain: cookie.domain,
    refreshTokenMaxAge: refreshTokenConfig.expiresDays * 24 * 60 * 60 * 1000,
  };

  constructor(
    private readonly service: MfaService,
    private readonly tokens: TokenService,
  ) {}

  // Which session this is: the refresh cookie (sent to every /api/v1/auth path).
  private ctx(req: Request): MfaContext {
    const raw = req.cookies?.refresh_token as string | undefined;
    return { userId: req.user!.userId, refreshTokenHash: raw ? this.tokens.hashRefreshToken(raw) : null, ipAddress: req.ip };
  }

  // A new access token (now with or without "otp"); the refresh cookie stays the same.
  private setAccessCookie(res: Response, accessToken: string) {
    res.cookie("access_token", accessToken, getAccessCookieOptions(this.cookieConfig));
  }

  status = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.status(this.ctx(req)));
  };

  startSetup = async (req: Request, res: Response) => {
    // The secret is shown once; don't let anything cache this response.
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, await this.service.startSetup(this.ctx(req)));
  };

  confirmSetup = async (req: Request, res: Response) => {
    const { backupCodes, accessToken } = await this.service.confirmSetup(this.ctx(req), (req.body as MfaCodeInput).code);
    this.setAccessCookie(res, accessToken);
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, { backupCodes });
  };

  verify = async (req: Request, res: Response) => {
    const { accessToken, backupCodesRemaining } = await this.service.verify(this.ctx(req), (req.body as MfaCodeInput).code);
    this.setAccessCookie(res, accessToken);
    sendSuccess(res, { verified: true, ...(backupCodesRemaining !== undefined && { backupCodesRemaining }) });
  };

  regenerateBackupCodes = async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, await this.service.regenerateBackupCodes(this.ctx(req), (req.body as MfaCodeInput).code));
  };

  disable = async (req: Request, res: Response) => {
    const body = req.body as MfaDisableInput;
    const { accessToken } = await this.service.disable(this.ctx(req), body.password, body.code);
    this.setAccessCookie(res, accessToken);
    sendSuccess(res, { enabled: false });
  };
}
