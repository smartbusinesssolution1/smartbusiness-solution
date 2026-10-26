import rateLimit from "express-rate-limit";
import { RedisRateLimitStore, type RateLimitRedis } from "@smartbusiness/auth";
import { rateLimits } from "../config/index.js";
import { producerConnection } from "../jobs/queues.js";
import { logger } from "../shared/services/logger.js";

// Counters live in Redis, so every server counts together and a restart or deploy doesn't
// reset them. If Redis can't be reached, each server counts in its own memory until it can.
// Each limiter has its own prefix: its counters never mix with another limiter's, or with
// Check Printing's, which uses the same Redis.
export interface LimiterOptions {
  prefix: string;
  redis?: RateLimitRedis;
}

function storeFor({ prefix, redis = producerConnection }: LimiterOptions) {
  return new RedisRateLimitStore({
    redis,
    prefix,
    onRedisError: (err) =>
      logger.warn({ err: err instanceof Error ? err.message : String(err), prefix }, "Rate limiting: Redis unreachable, counting in memory"),
  });
}

// Factories so tests can build a limiter with a small limit and prove it works,
// while the app uses the configured limits.
export function createGlobalRateLimiter(limit: number, options: LimiterOptions) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    store: storeFor(options),
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

export function createAuthRateLimiter(limit: number, options: LimiterOptions) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    store: storeFor(options),
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

export const globalRateLimiter = createGlobalRateLimiter(rateLimits.globalPerMinute, { prefix: "rl:platform:global:" });
export const authRateLimiter = createAuthRateLimiter(rateLimits.authPer15Minutes, { prefix: "rl:platform:auth:" });

// Session refresh has its own counter. The app refreshes on every visit after the 15-minute
// access token expires; sharing the sign-in budget would let ordinary page loads (or a whole
// office behind one IP) lock people out of signing in. A refresh token is 256 random bits,
// so this limit only stops floods, not guessing.
export const refreshRateLimiter = createAuthRateLimiter(rateLimits.refreshPer15Minutes, { prefix: "rl:platform:refresh:" });

// Invitation links get their own counter too: new people opening their invitation must
// not use up the sign-in attempts of everyone else behind the same office IP.
export const invitationRateLimiter = createAuthRateLimiter(rateLimits.invitationPer15Minutes, { prefix: "rl:platform:invitation:" });

// Two-factor codes get their own budget too: an office of admins signing in each morning
// sends one code each. Guessing is limited per account (attempts.ts), not by this.
export const mfaRateLimiter = createAuthRateLimiter(rateLimits.mfaPer15Minutes, { prefix: "rl:platform:mfa:" });
