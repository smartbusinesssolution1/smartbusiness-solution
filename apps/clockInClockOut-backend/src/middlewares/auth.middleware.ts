import { createAuthMiddleware, TokenService } from "@smartbusiness/auth";
import { env } from "../config/index.js";

const tokenService = new TokenService(env.jwt.accessToken.secret, env.jwt.accessToken.expiresIn);

export const authMiddleware = createAuthMiddleware(tokenService);
