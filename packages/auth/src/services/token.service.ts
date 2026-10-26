import jwt, { type SignOptions } from "jsonwebtoken";
import { generateOpaqueToken, hashOpaqueToken } from "../utils/opaque-token.js";
import { AuthError } from "../errors/index.js";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  // How this session proved who it is (OpenID Connect's "amr"): ["pwd"] after a
  // password, ["pwd", "otp"] once a two-factor code was also accepted. Products that
  // require two-factor (Check Printing, for its admins) look for "otp"; others ignore it.
  amr?: string[];
}

// Every login token is signed with HMAC-SHA256 and the shared JWT_SECRET.
const ALGORITHM = "HS256";

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string = "15m",
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: ALGORITHM,
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  // Only the algorithm we sign with is accepted. Left open, the library takes any HMAC
  // variant the token names in its own header; pinned, a token can't choose how it is checked.
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.secret, { algorithms: [ALGORITHM] }) as AccessTokenPayload;
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
