/*
  This is configuration module that will load all enviornment variables,
  validates them and exports a strongly-typed , read-only config object..

  RULES:
 1. This is the ONLY file that reads process.env
 2. Every other file imports config from here
 3. Never use process.env directly anywhere else
*/

import dotenv from "dotenv"
dotenv.config()
import { envSchema, Env } from "./env.schema.js"
import { z } from "zod"



// validate all the env variables at once.
// if any variable is missing we print clear error message
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables\n")

  const errors = z.flattenError(parsed.error).fieldErrors;

  for (const [field, message] of Object.entries(errors)) {
    console.error(`${field}: ${message?.join(" , ")}`)
  }

  console.error("Fix the above error in your .env file and restart")
  process.exit(1);
}

// Freeze the config object so no code can accidentally mutate it.
export const config: Readonly<Env> = Object.freeze(parsed.data)

export const db = {
  url: config.DATABASE_URL
} as const


export const accessToken = {
  secret: config.JWT_SECRET,
  expiresIn: config.ACCESS_TOKEN_EXPIRES_IN,
} as const

export const refreshToken = {
  expiresDays: config.REFRESH_TOKEN_EXPIRES_DAYS,
  maxSessionsPerUser: 5,
} as const

export const server = {
  port: config.PORT,
  nodeEnv: config.NODE_ENV,
  isDev: config.NODE_ENV === "development",
  isProd: config.NODE_ENV === "production",
  isStaging: config.NODE_ENV === "staging",
  isTest: config.NODE_ENV === "test",
} as const

export const rateLimit = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX
} as const

export const storage = {
  driver: config.STORAGE_DRIVER,
  localDirectory: config.PDF_STORAGE_PATH,
  s3: {
    bucket: config.S3_BUCKET ?? "",
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    serverSideEncryption: config.S3_SERVER_SIDE_ENCRYPTION,
    prefix: config.S3_PREFIX,
  },
  encryption: {
    currentKey: { id: config.STORAGE_ENCRYPTION_KEY_ID, hex: config.STORAGE_ENCRYPTION_KEY },
    previousKeys: config.STORAGE_PREVIOUS_KEYS,
  },
} as const;

export const app = {
  url: (config.APP_URL ?? "http://localhost:5173").replace(/\/+$/, ""),
} as const;

export const jobs = {
  redisUrl: config.REDIS_URL ?? "redis://127.0.0.1:6379",
  // Same policy as platform-api, which runs the worker: 5 tries, backing off from 10 s.
  retry: { attempts: 5, backoffMs: 10_000 },
} as const;

export const cors = {
  origin: config.CORS_ORIGIN
} as const


/*
 z.flattenError(parsed.error)
{
  formErrors: [],
  fieldErrors: {
    DATABASE_URL: [
      "DATABASE_URL is required"
    ],
    JWT_SECRET: [
      "JWT_SECRET is required"
    ],
    PORT: [
      "Too big: expected number to be <=65535"
    ]
  }
}

and we select .fieldErrors from it 

z.flattenError(parsed.error).fieldErrors;

so : 
our errors become : 
errors = {
  DATABASE_URL: [
    "DATABASE_URL is required"
  ],
  JWT_SECRET: [
    "JWT_SECRET is required"
  ],
  PORT: [
    "Too big: expected number to be <=65535"
  ]
}


*/