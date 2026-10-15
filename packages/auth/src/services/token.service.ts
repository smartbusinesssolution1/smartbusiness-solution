import jwt, { type SignOptions } from "jsonwebtoken";
import { generateOpaqueToken, hashOpaqueToken } from "../utils/opaque-token.js";
import { AuthError } from "../errors/index.js";

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string = "15m",
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.secret) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthError("Token expired. Please login again.");
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AuthError("Invalid token.");
      }
      throw new AuthError("Authentication failed.");
    }
  }

  generateRefreshToken(): { raw: string; hash: string } {
    return generateOpaqueToken();
  }

  hashRefreshToken(rawToken: string): string {
    return hashOpaqueToken(rawToken);
  }
}
