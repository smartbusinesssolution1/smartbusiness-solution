import rateLimit from "express-rate-limit";
import { env } from "../config/index.js";

export const globalRateLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs, // x minutes
    limit: env.server.isDev ? 50000 : env.rateLimit.limit,
    skip: () => env.server.isDev,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later."
        }
    }
})
