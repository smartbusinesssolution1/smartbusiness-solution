import rateLimit from "express-rate-limit";
import { RedisRateLimitStore } from "@smartbusiness/auth";
import { env } from "../config/index.js";
import { redisClient } from "../shared/services/redis.service.js";
import { logger } from "../shared/services/logger.js";

export const globalRateLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    limit: env.server.isDev ? 50000 : env.rateLimit.limit,
    skip: () => env.server.isDev,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({
        redis: redisClient,
        prefix: "rl:clockin:global:",
        onRedisError: (err) =>
            logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Rate limiting: Redis unreachable, counting in memory"),
    }),
    message: {
        success: false,
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later."
        }
    }
});
