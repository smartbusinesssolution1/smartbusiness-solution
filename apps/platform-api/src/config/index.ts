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
} as const;

export const cors = {
  origin: config.CORS_ORIGIN,
} as const;

export const cookie = {
  domain: config.COOKIE_DOMAIN,
} as const;
