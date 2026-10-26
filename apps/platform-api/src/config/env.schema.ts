import { z } from "zod";

export const envSchema = z
  .object({
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

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://localhost:5174")
    .transform((value) =>
      value
        .split(",")
        .map((s) => s.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    ),

  COOKIE_DOMAIN: z.string().optional(),

  // Requests per minute per IP, across the whole API.
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),

  // Sign-in, sign-up and password-reset attempts per IP per 15 minutes (brute-force protection).
  AUTH_RATE_LIMIT_MAX: z
    .string()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
  // Session refreshes per IP per 15 minutes: a separate budget, so routine refreshes never
  // use up the sign-in attempts above.
  REFRESH_RATE_LIMIT_MAX: z
    .string()
    .default("300")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),

  // The web app's address. Every link in an email is built from this, never from the
  // request, so a forged Host header cannot put someone else's site into our emails.
  APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:5173"),

  // How emails are delivered: "file" writes them to EMAIL_FILE_DIRECTORY (development),
  // "memory" keeps them in a list (tests). A real provider is added once chosen.
  EMAIL_TRANSPORT: z.enum(["file", "memory", "smtp"]).default("smtp"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .default("587")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("SmartBusiness <no-reply@smartbusiness.local>"),
  EMAIL_FILE_DIRECTORY: z.string().default("./tmp/emails"),

  // Job queue (BullMQ). redis:// locally, rediss:// (TLS) for a hosted Redis.
  REDIS_URL: z
    .string({ error: "REDIS_URL is required" })
    .regex(/^rediss?:\/\//, "REDIS_URL must start with redis:// or rediss://"),

  // Wait before the first retry of a failed job (later retries double it).
  JOB_RETRY_BACKOFF_MS: z
    .string()
    .default("10000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),

  // Run the job worker inside the API process. Default: yes in development and tests
  // (one command), no in production, where `pnpm start:worker` runs it separately.
  RUN_WORKER_IN_API: z.enum(["true", "false"]).optional(),

  PASSWORD_RESET_TTL_MINUTES: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(5).max(24 * 60)),
  })
  // Emails written to a folder or kept in memory on a production server would never
  // reach anyone. Refuse to start rather than fail silently.
  .refine((env) => env.NODE_ENV !== "production" || env.EMAIL_TRANSPORT === "smtp", {
    path: ["EMAIL_TRANSPORT"],
    message: "Production needs a real email provider; 'file' and 'memory' only work for development and tests",
  });

export type Env = z.infer<typeof envSchema>;
