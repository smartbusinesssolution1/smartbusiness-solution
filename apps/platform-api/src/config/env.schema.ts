import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),

  PORT: z
    .string()
    .default("3001")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535)),

  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL URL"),

  JWT_SECRET: z
    .string({ error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be at least 32 characters for security"),

  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),

  REFRESH_TOKEN_EXPIRES_DAYS: z
    .string()
    .default("7")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(90)),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  COOKIE_DOMAIN: z.string().optional(),

  // Requests per minute per IP, across the whole API.
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),

  // Sign-in, sign-up and refresh attempts per IP per 15 minutes (brute-force protection).
  AUTH_RATE_LIMIT_MAX: z
    .string()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
});

export type Env = z.infer<typeof envSchema>;
