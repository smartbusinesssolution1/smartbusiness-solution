import rateLimit from "express-rate-limit";
import { rateLimit as rateLimitConfig } from "../config/index.js";

export const globalRateLimiter = rateLimit({
    windowMs: rateLimitConfig.windowMs,
    limit: rateLimitConfig.max,
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

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // 10 attempts per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many authentication attempts. Please try again in 15 minutes."
        }
    }
})