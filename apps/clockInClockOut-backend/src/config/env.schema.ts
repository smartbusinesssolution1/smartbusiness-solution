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
        .pipe(
            z
                .array(
                    z.union([
                        z.literal("*"),
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
                        ),
                    ])
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
});

export type Env = z.infer<typeof envSchema>;