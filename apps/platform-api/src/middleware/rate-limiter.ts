import rateLimit from "express-rate-limit";
import { rateLimits } from "../config/index.js";

// Factories so tests can build a limiter with a small limit and prove it works,
// while the app uses the configured limits.
export function createGlobalRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
      },
    },
  });
}

export function createAuthRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many authentication attempts. Please try again in 15 minutes.",
      },
    },
  });
}

export const globalRateLimiter = createGlobalRateLimiter(rateLimits.globalPerMinute);
export const authRateLimiter = createAuthRateLimiter(rateLimits.authPer15Minutes);

// Session refresh has its own counter. The app refreshes on every visit after the 15-minute
// access token expires; sharing the sign-in budget would let ordinary page loads (or a whole
// office behind one IP) lock people out of signing in. A refresh token is 256 random bits,
// so this limit only stops floods, not guessing.
export const refreshRateLimiter = createAuthRateLimiter(rateLimits.refreshPer15Minutes);

// Invitation links get their own counter too: new people opening their invitation must
// not use up the sign-in attempts of everyone else behind the same office IP.
export const invitationRateLimiter = createAuthRateLimiter(rateLimits.invitationPer15Minutes);
