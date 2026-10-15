/*
 Every Enviornment Variables the applicatioin needs is defined here 
 with its type , constraint and default.

 If a required variable is missing the app refuses to start
*/
import { z } from "zod"

const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "staging", "production"])
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

    CORS_ORIGIN: z.string().default("http://localhost:5173"),

    ENCRYPTION_KEY: z.string().min(64, { error: "encryption key must be a 64 character string." }),

    E13B_FONT_PATH: z
        .string()
        .default("./micr/MICR.ttf"),

    // When true (the default), printing is refused if the MICR font fails the E-13B glyph check.
    E13B_FONT_STRICT: z
        .enum(["true", "false"])
        .default("true")
        .transform((val) => val === "true"),

    PDF_STORAGE_PATH: z
        .string()
        .default("./uploads"),

    // ─── File storage (check PDFs, signatures, attachments) ───
    // "local": the PDF_STORAGE_PATH folder (development, tests). "s3": an S3 bucket.
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),

    // Master key that encrypts every stored file (64 hex characters). Must differ
    // from ENCRYPTION_KEY, so a leak of one does not open the other.
    STORAGE_ENCRYPTION_KEY: z
        .string({ error: "STORAGE_ENCRYPTION_KEY is required" })
        .regex(HEX_KEY, "STORAGE_ENCRYPTION_KEY must be 64 hex characters"),
    STORAGE_ENCRYPTION_KEY_ID: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("k1"),
    // During a key rotation: older keys that must still open existing files, as
    // "id:hex,id:hex".
    STORAGE_PREVIOUS_KEYS: z
        .string()
        .default("")
        .transform((value, ctx) => {
            const keys = value.split(",").map((s) => s.trim()).filter(Boolean).map((pair) => {
                const [id, hex] = pair.split(":");
                return { id: id ?? "", hex: hex ?? "" };
            });
            for (const k of keys) {
                if (!/^[A-Za-z0-9_-]{1,32}$/.test(k.id) || !HEX_KEY.test(k.hex)) {
                    ctx.addIssue({ code: "custom", message: `Invalid previous key "${k.id}": use id:64-hex-characters` });
                }
            }
            return keys;
        }),

    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    // Only for S3-compatible services (R2, test servers); leave empty for AWS.
    S3_ENDPOINT: z.url().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
    S3_SERVER_SIDE_ENCRYPTION: z.enum(["AES256", "none"]).default("AES256"),
    S3_PREFIX: z.string().regex(/^([A-Za-z0-9_-]+\/)*$/, "S3_PREFIX must look like folder/ or a/b/").default(""),

})
    .refine((env) => env.STORAGE_DRIVER !== "s3" || !!env.S3_BUCKET, {
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_DRIVER=s3",
    })
    // Local disk is wiped on redeploys and not shared between servers.
    .refine((env) => env.NODE_ENV !== "production" || env.STORAGE_DRIVER === "s3", {
        path: ["STORAGE_DRIVER"],
        message: "Production must store files in S3 (STORAGE_DRIVER=s3)",
    })
    .refine((env) => env.STORAGE_ENCRYPTION_KEY.toLowerCase() !== env.ENCRYPTION_KEY.toLowerCase(), {
        path: ["STORAGE_ENCRYPTION_KEY"],
        message: "STORAGE_ENCRYPTION_KEY must be different from ENCRYPTION_KEY",
    })

// infer typescript types from the schema
// this give us a strongly type config object
// without manul defining an interface
export type Env = z.infer<typeof envSchema>;