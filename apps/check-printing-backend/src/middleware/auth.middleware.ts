import { NextFunction, Request, Response } from "express";
import { TokenService } from "../shared/services/token.service.js";
import { AuthError } from "../shared/errors/auth-error.js";

const tokenService = new TokenService();

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;

  if (!token) {
    throw new AuthError("Authentication required. Please log in.");
  }

  const payload = tokenService.verifyAccessToken(token);

  req.user = {
    userId: payload.userId,
    email: payload.email,
    tenantId: payload.tenantId,
  };

  next();
}
