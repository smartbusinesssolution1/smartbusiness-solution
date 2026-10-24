import { z } from "zod";

export const envSchema = z.object({
    NODE_ENV: z
        .enum(["dev", "test", "prod"]),

    PORT: z.coerce
        .number()
        .int()
        .positive(),


    ORIGIN: z
        .string()
        .min(1)
        .transform((value) =>
            value
                .split(",")
                .map((origin) => origin.trim())
                .filter(Boolean)
        )
        // No "*": the session is in cookies, so only the listed websites may call this API.
        .refine((origins) => !origins.includes("*"), {
            message: 'ORIGIN cannot be "*": list the exact frontend origins, comma-separated',
        })
        .pipe(
            z
                .array(
                    z.url().refine(
                        (value) => {
                            const url = new URL(value);
                            return (
                                url.protocol === "http:" ||
                                url.protocol === "https:"
                            );
                        },
                        {
                            message: "ORIGIN must use http or https",
                        }
                    )
                )
                .min(1)
        ),

    DATABASE_URL: z
        .string()
        .url("Must be a valid URL")
        .startsWith("postgresql://", "Must be a PostgreSQL URL"),

    RATE_LIMIT_WINDOWMS: z.coerce
        .number()
        .int()
        .positive(),

    RATE_LIMIT_MAX: z.coerce
        .number()
        .int()
        .positive(),

    JWT_ACCESS_TOKEN_SECRET: z
        .string()
        .min(32, "JWT access token secret must be at least 32 characters long"),

    JWT_ACCESS_TOKEN_EXPIRES_IN: z
        .string()
        .regex(
            /^\d+(s|m|h|d|w)$/,
            "JWT access token expiry must be like 15m, 1h, 7d, etc."
        ),

    DB_POOL_MAX: z.coerce
        .number()
        .int()
        .positive()
        .default(10),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
        .string()
        .optional()
        .transform((val) => val === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    PORTAL_LOGIN_URL: z.string().default("http://localhost:5173/login"),

    // AWS S3
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET_NAME: z.string().optional(),
    FACE_RECOGNITION_API_URL: z.string().default("http://127.0.0.1:8000"),
});

export type Env = z.infer<typeof envSchema>;