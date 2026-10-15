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
