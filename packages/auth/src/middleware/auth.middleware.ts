import type { NextFunction, Request, Response } from "express";
import { TokenService } from "../services/token.service.js";
import { AuthError } from "../errors/index.js";

export function createAuthMiddleware(tokenService: TokenService) {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
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
