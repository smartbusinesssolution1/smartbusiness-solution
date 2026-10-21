import dotenv from "dotenv";
dotenv.config();
import { envSchema, type Env } from "./env.schema.js";
import { z } from "zod";

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables\n");
  const errors = z.flattenError(parsed.error).fieldErrors;
  for (const [field, message] of Object.entries(errors)) {
    console.error(`${field}: ${message?.join(", ")}`);
  }
  console.error("Fix the above errors in your .env file and restart");
  process.exit(1);
}

export const config: Readonly<Env> = Object.freeze(parsed.data);

export const accessToken = {
  secret: config.JWT_SECRET,
  expiresIn: config.ACCESS_TOKEN_EXPIRES_IN,
} as const;

export const refreshToken = {
  expiresDays: config.REFRESH_TOKEN_EXPIRES_DAYS,
  maxSessionsPerUser: 5,
} as const;

export const server = {
  port: config.PORT,
  nodeEnv: config.NODE_ENV,
  isDev: config.NODE_ENV === "development",
  isProd: config.NODE_ENV === "production",
  isTest: config.NODE_ENV === "test",
} as const;

export const app = {
  url: config.APP_URL.replace(/\/+$/, ""),
} as const;

export const email = {
  transport: config.EMAIL_TRANSPORT,
  from: config.EMAIL_FROM,
  fileDirectory: config.EMAIL_FILE_DIRECTORY,
  smtp: config.SMTP_HOST
    ? {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE === "true",
        // Production insists on TLS; Mailpit on this machine has none.
        requireTls: config.NODE_ENV === "production",
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      }
    : undefined,
} as const;

export const passwordReset = {
  ttlMinutes: config.PASSWORD_RESET_TTL_MINUTES,
} as const;

export const invitation = {
  ttlDays: config.INVITATION_TTL_DAYS,
} as const;

export const jobs = {
  redisUrl: config.REDIS_URL,
  retry: { attempts: 5, backoffMs: config.JOB_RETRY_BACKOFF_MS },
  runWorkerInApi:
    config.RUN_WORKER_IN_API === undefined ? config.NODE_ENV !== "production" : config.RUN_WORKER_IN_API === "true",
} as const;

export const rateLimits = {
  globalPerMinute: config.RATE_LIMIT_MAX,
  authPer15Minutes: config.AUTH_RATE_LIMIT_MAX,
  refreshPer15Minutes: config.REFRESH_RATE_LIMIT_MAX,
  invitationPer15Minutes: config.INVITATION_RATE_LIMIT_MAX,
} as const;

export const cors = {
  origin: config.CORS_ORIGIN,
} as const;

export const cookie = {
  domain: config.COOKIE_DOMAIN,
} as const;
