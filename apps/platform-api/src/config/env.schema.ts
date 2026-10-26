import { z } from "zod";

// A rate limit left unset takes its default from config/index.ts, which is strict in
// production and staging and roomier in development (see rateLimits there).
const optionalLimit = z
  .string()
  .regex(/^\d+$/, "Must be a whole number")
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().int().min(1))
  .optional();

export const envSchema = z
  .object({
    // Required, with no default. A server started without it used to fall back to
    // "development" without a word: login cookies without Secure, stack traces sent to
    // users, local-network origins allowed, development rate limits. Development has to be
    // asked for, never assumed.
    NODE_ENV: z.enum(["development", "test", "staging", "production"], {
      error: "NODE_ENV is required: development, test, staging or production",
    }),

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
    RATE_LIMIT_MAX: optionalLimit,

    // Sign-in, sign-up and password-reset attempts per IP per 15 minutes (brute-force protection).
    AUTH_RATE_LIMIT_MAX: optionalLimit,
    // Session refreshes per IP per 15 minutes: a separate budget, so routine refreshes never
    // use up the sign-in attempts above.
    REFRESH_RATE_LIMIT_MAX: optionalLimit,
    // Invitation page views and accepts per IP per 15 minutes, also a separate budget: an
    // office behind one IP onboarding several people must not lock itself out of signing
    // in. The links are 256-bit secrets, so this only stops floods, not guessing.
    INVITATION_RATE_LIMIT_MAX: optionalLimit,
    // Two-factor code requests per IP per 15 minutes, a separate budget again.
    MFA_RATE_LIMIT_MAX: optionalLimit,

    // The web app's address. Every link in an email is built from this, never from the
    // request, so a forged Host header cannot put someone else's site into our emails.
    APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:5173"),

    // How emails are delivered: "smtp" sends them (Mailpit locally, AWS SES in production),
    // "file" writes them to EMAIL_FILE_DIRECTORY, "memory" keeps them in a list (tests).
    EMAIL_TRANSPORT: z.enum(["smtp", "file", "memory"]).default("file"),
    EMAIL_FROM: z.string().min(3).default("SmartBusiness <no-reply@smartbusiness.local>"),
    EMAIL_FILE_DIRECTORY: z.string().default("./tmp/emails"),

    // SMTP (EMAIL_TRANSPORT=smtp). Locally: Mailpit, 127.0.0.1:1025 without a login.
    // AWS SES: email-smtp.<region>.amazonaws.com, port 587, SES SMTP credentials.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z
      .string()
      .default("587")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(65535)),
    // "true" only for port 465 (TLS from the start); 587 upgrades with STARTTLS.
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

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

    // How long a workspace invitation link works. The inviter can resend at any time,
    // which replaces the old link.
    INVITATION_TTL_DAYS: z
      .string()
      .default("7")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(30)),

    PASSWORD_RESET_TTL_MINUTES: z
      .string()
      .default("60")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(5).max(24 * 60)),

    // Two-factor sign-in: encrypts authenticator secrets (AES-256-GCM) and keys the
    // backup-code fingerprints. Exactly 64 hex characters (256 bits). Keep it out of the
    // database: whoever holds both could calculate every admin's codes.
    MFA_ENCRYPTION_KEY: z
      .string({ error: "MFA_ENCRYPTION_KEY is required" })
      .regex(/^[0-9a-fA-F]{64}$/, "MFA_ENCRYPTION_KEY must be exactly 64 hex characters (generate with: openssl rand -hex 32)"),
  })
  // A production database is reached over TLS with its certificate checked. The driver
  // treats "require" as verify-full today, but its next major version gives "require" the
  // weaker standard meaning (encrypt, don't verify), so production says verify-full outright.
  .refine((env) => env.NODE_ENV !== "production" || new URL(env.DATABASE_URL).searchParams.get("sslmode") === "verify-full", {
    path: ["DATABASE_URL"],
    message: "Production DATABASE_URL must end with ?sslmode=verify-full (TLS with the server's certificate checked)",
  })
  // Emails written to a folder or kept in memory on a production server would never
  // reach anyone. Refuse to start rather than fail silently.
  .refine((env) => env.NODE_ENV !== "production" || env.EMAIL_TRANSPORT === "smtp", {
    path: ["EMAIL_TRANSPORT"],
    message: "Production needs a real email provider; 'file' and 'memory' only work for development and tests",
  })
  .refine((env) => env.EMAIL_TRANSPORT !== "smtp" || Boolean(env.SMTP_HOST), {
    path: ["SMTP_HOST"],
    message: "EMAIL_TRANSPORT=smtp needs SMTP_HOST (127.0.0.1 for Mailpit, the SES endpoint in production)",
  })
  // A real provider is always reached over TLS with a login; plain, anonymous SMTP is
  // only for Mailpit on this machine.
  .refine((env) => env.NODE_ENV !== "production" || env.EMAIL_TRANSPORT !== "smtp" || Boolean(env.SMTP_USER && env.SMTP_PASS), {
    path: ["SMTP_USER"],
    message: "Production SMTP needs SMTP_USER and SMTP_PASS (the SES SMTP credentials)",
  });

export type Env = z.infer<typeof envSchema>;
