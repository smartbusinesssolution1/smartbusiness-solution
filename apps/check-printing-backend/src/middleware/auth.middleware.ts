import { createAuthMiddleware, TokenService } from "@smartbusiness/auth";
import { accessToken } from "../config/index.js";

const tokenService = new TokenService(accessToken.secret, accessToken.expiresIn);

export const authMiddleware = createAuthMiddleware(tokenService);
