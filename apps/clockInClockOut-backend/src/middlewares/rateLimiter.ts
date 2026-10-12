import rateLimit from "express-rate-limit";
import { env } from "../config/index.js";

export const globalRateLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs, // x minutes
    limit: env.rateLimit.limit, // y attempts per x min
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
