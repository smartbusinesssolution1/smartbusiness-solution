import rateLimit from "express-rate-limit";

export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
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

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many authentication attempts. Please try again in 15 minutes.",
    },
  },
});
