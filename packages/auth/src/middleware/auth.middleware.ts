import type { NextFunction, Request, Response } from "express";
import { TokenService } from "../services/token.service.js";
import { AuthError } from "../errors/index.js";

export function createAuthMiddleware(tokenService: TokenService) {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    // Only the httpOnly cookie is accepted. Tokens are never handed to JavaScript, so there is
    // no other legitimate way to present one; an Authorization header is ignored.
    const token = req.cookies?.access_token;

    if (!token) {
      throw new AuthError("Authentication required. Please log in.");
    }

    const payload = tokenService.verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  };
}
