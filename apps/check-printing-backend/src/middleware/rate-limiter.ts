import rateLimit from "express-rate-limit";
import { RedisRateLimitStore, type RateLimitRedis } from "@smartbusiness/auth";
import { rateLimit as rateLimitConfig } from "../config/index.js";
import { producerConnection } from "../jobs/queues.js";
import { logger } from "../shared/services/logger.js";

// Counters live in Redis (the one the job queue uses), so every server counts together and
// a restart or deploy doesn't reset them. If Redis can't be reached, each server counts in
// its own memory until it can. The prefix keeps them apart from platform-api's counters.
export function createGlobalRateLimiter(limit: number, options: { prefix: string; redis?: RateLimitRedis }) {
    return rateLimit({
        windowMs: rateLimitConfig.windowMs,
        limit,
        store: new RedisRateLimitStore({
            redis: options.redis ?? producerConnection,
            prefix: options.prefix,
            onRedisError: (err) =>
                logger.warn({ err: err instanceof Error ? err.message : String(err), prefix: options.prefix }, "Rate limiting: Redis unreachable, counting in memory"),
        }),
        standardHeaders: true, // This tells the middleware to send standardized rate-limit headers in responses.
        legacyHeaders: false, // This disables the older X-RateLimit-* style headers.
        message: {
            success: false,
            error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many requests. Please try again later."
            }
        }
    })
}

export const globalRateLimiter = createGlobalRateLimiter(rateLimitConfig.max, { prefix: "rl:check:global:" })
