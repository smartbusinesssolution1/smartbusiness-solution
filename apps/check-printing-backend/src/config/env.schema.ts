/*
 Every Enviornment Variables the applicatioin needs is defined here 
 with its type , constraint and default.

 If a required variable is missing the app refuses to start
*/
import { z } from "zod"

const HEX_KEY = /^[0-9a-fA-F]{64}$/;

// "https://app.example.com" or "https://app.example.com/" → "https://app.example.com".
// Anything with a path, query, credentials or a scheme other than http(s) → null.
function toOrigin(entry: string): string | null {
    let url: URL;
    try {
        url = new URL(entry);
    } catch {
        return null;
    }
    const isOriginOnly =
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
    return isOriginOnly ? url.origin : null;
}

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

    // The frontends allowed to call this API from a browser, comma-separated (the platform
    // has several: this product's app, the customer portal). Requests carry login cookies,
    // so every entry must be an exact origin we own; "*" is refused.
    CORS_ORIGIN: z
        .string()
        .default("http://localhost:5173")
        .transform((value, ctx) => {
            const entries = value.split(",").map((s) => s.trim()).filter(Boolean);
            if (entries.length === 0) {
                ctx.addIssue({ code: "custom", message: "CORS_ORIGIN must list at least one origin" });
                return z.NEVER;
            }
            const origins: string[] = [];
            for (const entry of entries) {
                const origin = toOrigin(entry);
                if (!origin) {
                    ctx.addIssue({
                        code: "custom",
                        message: `"${entry}" is not an origin: use scheme://host[:port], e.g. https://checks.example.com`,
                    });
                    continue;
                }
                origins.push(origin);
            }
            return origins;
        }),

    // Decrypts every stored bank account number: an AES-256 key is exactly 32 bytes, i.e. 64 hex
    // characters. Anything else used to pass startup and only fail on the first bank operation.
    ENCRYPTION_KEY: z
        .string({ error: "ENCRYPTION_KEY is required" })
        .regex(HEX_KEY, "ENCRYPTION_KEY must be exactly 64 hex characters (0-9, a-f)"),

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

    // The web app's address: links in emails (approval notices) are built from it, never
    // from a request, so a forged Host header cannot put another site into our emails.
    APP_URL: z.url({ protocol: /^https?$/ }).optional(),

    // ─── Job queue (Redis, shared with platform-api) ───
    // Invitation emails are queued here and sent by platform-api's worker. Locally the
    // Redis from docker-compose.dev.yml; rediss:// (TLS) for a hosted Redis.
    REDIS_URL: z
        .string()
        .regex(/^rediss?:\/\//, "REDIS_URL must start with redis:// or rediss://")
        .optional(),

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
    // Locally the default app address is fine; a server must say where its web app is.
    .refine((env) => env.NODE_ENV !== "production" || !!env.APP_URL, {
        path: ["APP_URL"],
        message: "APP_URL is required in production (links in emails are built from it)",
    })
    // Locally the default Redis is fine; a server must say which one it uses.
    .refine((env) => env.NODE_ENV !== "production" || !!env.REDIS_URL, {
        path: ["REDIS_URL"],
        message: "REDIS_URL is required in production (invitation emails are queued there)",
    })
    .refine((env) => env.STORAGE_ENCRYPTION_KEY.toLowerCase() !== env.ENCRYPTION_KEY.toLowerCase(), {
        path: ["STORAGE_ENCRYPTION_KEY"],
        message: "STORAGE_ENCRYPTION_KEY must be different from ENCRYPTION_KEY",
    })

// infer typescript types from the schema
// this give us a strongly type config object
// without manul defining an interface
export type Env = z.infer<typeof envSchema>;