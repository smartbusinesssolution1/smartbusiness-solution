/*
 Every Enviornment Variables the applicatioin needs is defined here 
 with its type , constraint and default.

 If a required variable is missing the app refuses to start
*/
import { z } from "zod"

export const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "staging", "production"])
        .default('development'),

    PORT: z
        .string()
        .default("3005")
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().min(1).max(65535)),

    DATABASE_URL: z
        .string({ error: "DATABASE_URL is required" })
        .min(1, "DATABASE_URL is required")
        .url("DATABASE_URL must be a valid URL")
        .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL URL"),

    JWT_SECRET: z.string({ error: "JWT_SECRET is required" })
        .min(32, "JWT_SECRET must be at least 32 characters for security"),

    ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),

    REFRESH_TOKEN_EXPIRES_DAYS: z
        .string()
        .default("7")
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().min(1).max(90)),

    RATE_LIMIT_WINDOW_MS: z
        .string()
        .default("60000")
        .transform((val) => parseInt(val, 10)),

    RATE_LIMIT_MAX: z
        .string()
        .default("100")
        .transform((val) => parseInt(val, 10)),

    CORS_ORIGIN: z.string().default("http://localhost:5173")

})

// infer typescript types from the schema
// this give us a strongly type config object
// without manul defining an interface
export type Env = z.infer<typeof envSchema>;