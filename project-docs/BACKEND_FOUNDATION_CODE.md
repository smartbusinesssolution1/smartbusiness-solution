# Production-Grade Express Backend: Foundation Layer
# Configuration · App · Server · Middleware · Error Handling

**Purpose:** This document teaches the architecture AND provides the actual implementation code for the foundation layer of any production Express.js backend. Written for the SmartBusinessSolutions Check Printing API, but the patterns apply to any SaaS product.

**How to use:** Read the architecture explanation first. Understand WHY each piece exists. Then implement the code. Every file is production-ready — not a tutorial shortcut.

---

# PART 1: THE STARTUP LIFECYCLE

## What Happens When You Run `pnpm dev`?

When you type `pnpm dev` and hit enter, your `package.json` script executes `tsx watch src/server.ts`. The `tsx` tool loads `server.ts` and begins executing it top-to-bottom. Here is the exact sequence, in the exact order, with every step explained:

```
═══════════════════════════════════════════════════════════
                    STARTUP SEQUENCE
═══════════════════════════════════════════════════════════

Step 1:  server.ts begins executing
              │
Step 2:  import config from "./config/index.js"
              │
              ├──▶ config/index.ts loads dotenv (.env file)
              ├──▶ config/env.ts defines Zod schema for ALL env vars
              ├──▶ config/index.ts validates env vars against schema
              │
              ├── IF VALIDATION FAILS:
              │     Print clear error: "FATAL: JWT_SECRET is not set"
              │     Process exits with code 1
              │     Server NEVER starts
              │
              └── IF VALIDATION PASSES:
                    Export strongly-typed config object
                    Continue to Step 3
              │
Step 3:  import { prisma } from "@smartbusiness/database"
              │
              ├──▶ Prisma singleton is created
              └──▶ Connection pool is initialized (lazy — connects on first query)
              │
Step 4:  import { createApp } from "./app.js"
              │
              ├──▶ app.ts creates Express instance
              ├──▶ Registers middleware in ORDER:
              │     1. CORS
              │     2. Helmet (security headers)
              │     3. Rate limiter
              │     4. JSON body parser (with size limit)
              │     5. URL-encoded parser
              │     6. Request ID generator
              │     7. Request logger
              │     8. Health check route (before auth — must be public)
              │     9. API routes (auth middleware applied per-route)
              │    10. 404 Not Found handler
              │    11. Global error handler (MUST be last)
              │
              └──▶ Returns configured Express app (does NOT listen yet)
              │
Step 5:  server.ts calls startServer()
              │
              ├──▶ Test database connection: prisma.$queryRaw`SELECT 1`
              │     IF FAILS: log error, exit process
              │
              ├──▶ app.listen(config.port)
              │     Server is now accepting HTTP requests
              │
              ├──▶ Register shutdown handlers:
              │     SIGTERM → graceful shutdown
              │     SIGINT  → graceful shutdown
              │     Unhandled rejection → log + shutdown
              │     Uncaught exception → log + shutdown
              │
              └──▶ Log: "Server running on http://localhost:3000"

═══════════════════════════════════════════════════════════
                    SERVER IS READY
═══════════════════════════════════════════════════════════
```

**Why this specific order matters:**

Config loads FIRST because every other module needs config values. If the database module tries to connect before config validates `DATABASE_URL`, it gets `undefined` and throws a cryptic error.

Prisma loads SECOND because the app needs database access for auth middleware and routes.

The Express app is created THIRD because it needs config values (CORS origins, rate limit settings) and potentially the database connection.

The server starts listening LAST because everything must be ready before accepting requests. If we started listening before the database was connected, the first request would fail.

---

# PART 2: FOLDER STRUCTURE

```
apps/check-printing-api/
├── src/
│   ├── server.ts              ← Entry point: connect DB, start HTTP, handle shutdown
│   ├── app.ts                 ← Express app: middleware pipeline, route registration
│   │
│   ├── config/
│   │   ├── index.ts           ← Loads .env, validates, exports typed config object
│   │   └── env.schema.ts      ← Zod schema defining ALL required env variables
│   │
│   ├── middleware/
│   │   ├── error-handler.ts   ← Global error catching middleware (registered LAST)
│   │   ├── not-found.ts       ← 404 handler for unmatched routes
│   │   ├── request-id.ts      ← Generates unique ID per request for tracing
│   │   ├── request-logger.ts  ← Logs every HTTP request (method, path, status, time)
│   │   ├── rate-limiter.ts    ← Rate limiting configuration
│   │   ├── auth.middleware.ts ← JWT verification (built in Day 2)
│   │   ├── workspace.middleware.ts ← Workspace loading (built in Day 3)
│   │   ├── permission.guard.ts    ← Permission checking (built in Day 3)
│   │   └── validate.ts       ← Zod validation middleware factory
│   │
│   ├── modules/               ← Feature modules (built Day 2+)
│   │   ├── auth/
│   │   ├── workspace/
│   │   ├── bank-account/
│   │   ├── check/
│   │   └── ...
│   │
│   ├── shared/
│   │   ├── errors/
│   │   │   ├── app-error.ts        ← Base error class with status code
│   │   │   ├── validation-error.ts ← 400 errors
│   │   │   ├── auth-error.ts       ← 401 errors
│   │   │   ├── forbidden-error.ts  ← 403 errors
│   │   │   ├── not-found-error.ts  ← 404 errors
│   │   │   ├── conflict-error.ts   ← 409 errors
│   │   │   └── index.ts            ← Re-exports all error classes
│   │   │
│   │   ├── utils/
│   │   │   ├── response.ts         ← Standard success/error response helpers
│   │   │   ├── async-handler.ts    ← Wraps async route handlers to catch errors
│   │   │   └── pagination.ts       ← Pagination helpers
│   │   │
│   │   └── types/
│   │       └── express.d.ts        ← Extend Express Request with user, workspace, permissions
│   │
│   └── routes/
│       └── index.ts           ← Central route registration (mounts all module routes)
│
├── .env                       ← Environment variables (gitignored)
├── .env.example               ← Template showing required variables (committed)
├── package.json
└── tsconfig.json
```

**Why `config/` has its own folder instead of a single file:** As the project grows, config may include database-specific settings, S3-specific settings, email-specific settings, and feature flag settings. Separating the Zod schema (`env.schema.ts`) from the loading logic (`index.ts`) keeps each file focused. For now it is two files. In six months it might be four. The folder structure accommodates growth without reorganization.

**Why `shared/errors/` instead of just one error file:** Each error class is small (10-15 lines), but having them in separate files means your import is readable: `import { NotFoundError } from "../shared/errors/index.js"`. When you add a new error type (say, `RateLimitError`), you create one file — no modification to existing files.

**Why `shared/utils/` exists separately from module helpers:** Utilities like `asyncHandler`, `sendSuccess`, and `paginate` are used by EVERY module. They are not business logic — they are plumbing. Putting them in a module folder would create awkward cross-module imports.

---

# PART 3: THE CODE — File by File

## File 1: `src/config/env.schema.ts`

This file defines the shape of your environment. It is the contract between your application and the deployment environment. If the deployment is missing a variable, this file catches it before any damage is done.

```typescript
import { z } from "zod";

// ═══════════════════════════════════════════════════════
// Environment Variable Schema
// ═══════════════════════════════════════════════════════
// Every environment variable the application needs is
// defined here with its type, constraints, and default.
// If a required variable is missing, the app refuses to start.
// ═══════════════════════════════════════════════════════

export const envSchema = z.object({
  // ─── Server ───────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535)),

  // ─── Database ─────────────────────────────────────
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .url("DATABASE_URL must be a valid URL")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL URL"),

  // ─── JWT Authentication ───────────────────────────
  JWT_SECRET: z
    .string({ required_error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be at least 32 characters for security"),

  JWT_EXPIRES_IN: z
    .string()
    .default("7d"),

  // ─── Encryption (AES-256) ─────────────────────────
  ENCRYPTION_KEY: z
    .string({ required_error: "ENCRYPTION_KEY is required" })
    .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),

  // ─── CORS ─────────────────────────────────────────
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173"),

  // ─── S3/R2 Storage ────────────────────────────────
  S3_ENDPOINT: z
    .string()
    .url()
    .optional(),

  S3_BUCKET: z
    .string()
    .default("smartbusiness-dev"),

  S3_ACCESS_KEY_ID: z
    .string()
    .optional(),

  S3_SECRET_ACCESS_KEY: z
    .string()
    .optional(),

  S3_REGION: z
    .string()
    .default("auto"),

  // ─── Email ────────────────────────────────────────
  RESEND_API_KEY: z
    .string()
    .optional(),

  EMAIL_FROM: z
    .string()
    .email()
    .default("noreply@smartbusiness.dev"),

  // ─── Rate Limiting ────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10)),

  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10)),
});

// Infer the TypeScript type from the schema.
// This gives us a strongly-typed config object
// without manually defining an interface.
export type Env = z.infer<typeof envSchema>;
```

**Why `transform` on PORT?** Environment variables are ALWAYS strings. `process.env.PORT` is `"3000"` (a string), not `3000` (a number). The `.transform()` converts it to a number, and the `.pipe(z.number().min(1).max(65535))` validates the converted number is in the valid port range. Without this, your code would compare `"3000" > 65535` which is a string comparison, not a numeric one — and it would pass because `"3" > "6"` is false in string comparison for the wrong reasons.

**Why ENCRYPTION_KEY is exactly 64 characters?** AES-256 requires a 256-bit key. 256 bits = 32 bytes. Hex-encoded, each byte is 2 hex characters. 32 bytes × 2 = 64 hex characters. The `.length(64)` constraint ensures the key is the correct size before the encryption service tries to use it and fails with an unhelpful "invalid key length" error.

**Why some fields are `.optional()` and others are `required_error`?** S3 and email are optional because in local development, you might not have these services configured. The app should still start — you just cannot upload files or send emails. But DATABASE_URL, JWT_SECRET, and ENCRYPTION_KEY are required because without them, core functionality is impossible.

---

## File 2: `src/config/index.ts`

This is the config module's entry point. It loads the `.env` file, validates everything, and exports a frozen config object.

```typescript
import dotenv from "dotenv";
import path from "path";
import { envSchema, type Env } from "./env.schema.js";

// ═══════════════════════════════════════════════════════
// Configuration Module
// ═══════════════════════════════════════════════════════
// Loads environment variables, validates them, and exports
// a strongly-typed, read-only config object.
//
// RULES:
// 1. This is the ONLY file that reads process.env
// 2. Every other file imports config from here
// 3. Never use process.env directly anywhere else
// ═══════════════════════════════════════════════════════

// Load .env file. In production, env vars are set by the
// deployment platform (Railway, AWS), not by a .env file.
// dotenv silently does nothing if the file doesn't exist.
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

// Validate all environment variables at once.
// If ANY required variable is missing or invalid,
// this prints a clear error and crashes IMMEDIATELY.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n╔═══════════════════════════════════════════╗");
  console.error("║  FATAL: Environment validation failed     ║");
  console.error("╚═══════════════════════════════════════════╝\n");

  const errors = parsed.error.flatten().fieldErrors;

  for (const [field, messages] of Object.entries(errors)) {
    console.error(`  ✗ ${field}: ${messages?.join(", ")}`);
  }

  console.error("\n  Fix the above errors in your .env file and restart.\n");
  process.exit(1);
}

// Freeze the config object so no code can accidentally mutate it.
// config.port = 9999 would silently fail (or throw in strict mode).
export const config: Readonly<Env> = Object.freeze(parsed.data);

// Export individual sections for convenience.
// Instead of config.DATABASE_URL, modules can import { db } and use db.url.
export const db = {
  url: config.DATABASE_URL,
} as const;

export const jwt = {
  secret: config.JWT_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
} as const;

export const server = {
  port: config.PORT,
  nodeEnv: config.NODE_ENV,
  isDev: config.NODE_ENV === "development",
  isProd: config.NODE_ENV === "production",
  isStaging: config.NODE_ENV === "staging",
} as const;

export const cors = {
  origin: config.CORS_ORIGIN,
} as const;

export const storage = {
  endpoint: config.S3_ENDPOINT,
  bucket: config.S3_BUCKET,
  accessKeyId: config.S3_ACCESS_KEY_ID,
  secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  region: config.S3_REGION,
} as const;

export const email = {
  apiKey: config.RESEND_API_KEY,
  from: config.EMAIL_FROM,
} as const;

export const rateLimit = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
} as const;
```

**Why `Object.freeze()`?** Without freezing, any module could accidentally mutate the config: `config.PORT = 9999`. This would silently change the config for the entire application — a nightmare to debug. `Object.freeze()` makes the object immutable. Any attempt to modify it is silently ignored (or throws in strict mode).

**Why grouped exports (`db`, `jwt`, `server`)?** Without grouping, every file that needs the JWT secret writes `config.JWT_SECRET`. With grouping, they write `jwt.secret` — shorter, more readable, and it makes imports self-documenting: `import { jwt } from "../config/index.js"` immediately tells you this file deals with JWT.

**Why `as const`?** The `as const` assertion makes the grouped objects deeply readonly at the TypeScript level (not just runtime like `Object.freeze`). TypeScript will show an error if you try to assign to `jwt.secret`.

---

## File 3: `src/shared/errors/app-error.ts`

The base error class that all custom errors extend.

```typescript
// ═══════════════════════════════════════════════════════
// Base Application Error
// ═══════════════════════════════════════════════════════
// All custom errors extend this class. It carries:
// - HTTP status code (for the response)
// - Machine-readable error code (for the frontend)
// - Human-readable message (for the developer/user)
// - isOperational flag (expected error vs bug)
// ═══════════════════════════════════════════════════════

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly (required for instanceof to work
    // correctly with TypeScript class inheritance from built-in Error)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**What is `isOperational`?** This distinguishes between expected errors and bugs. A "check not found" error is operational — the system is working correctly, the data just does not exist. A null reference error is NOT operational — it is a bug in our code. The error handler treats them differently: operational errors return a clear message to the client. Non-operational errors return a generic "Something went wrong" and trigger an alert to the development team.

```typescript
// src/shared/errors/validation-error.ts
import { AppError } from "./app-error.js";

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string = "Validation failed", details: Record<string, string[]> = {}) {
    super(message, 400, "VALIDATION_FAILED");
    this.details = details;
  }
}

// src/shared/errors/auth-error.ts
import { AppError } from "./app-error.js";

export class AuthError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

// src/shared/errors/forbidden-error.ts
import { AppError } from "./app-error.js";

export class ForbiddenError extends AppError {
  constructor(message: string = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

// src/shared/errors/not-found-error.ts
import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

// src/shared/errors/conflict-error.ts
import { AppError } from "./app-error.js";

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

// src/shared/errors/index.ts
export { AppError } from "./app-error.js";
export { ValidationError } from "./validation-error.js";
export { AuthError } from "./auth-error.js";
export { ForbiddenError } from "./forbidden-error.js";
export { NotFoundError } from "./not-found-error.js";
export { ConflictError } from "./conflict-error.js";
```

---

## File 4: `src/shared/utils/response.ts`

Standard response helpers that every controller uses.

```typescript
import { Response } from "express";

// ═══════════════════════════════════════════════════════
// Standard Response Helpers
// ═══════════════════════════════════════════════════════
// Every API response uses one of these functions.
// This guarantees consistent response shapes across
// all 50+ endpoints.
// ═══════════════════════════════════════════════════════

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: PaginationMeta
): void {
  const response: Record<string, unknown> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
```

---

## File 5: `src/shared/utils/async-handler.ts`

This tiny utility solves one of Express's biggest pain points.

```typescript
import { Request, Response, NextFunction, RequestHandler } from "express";

// ═══════════════════════════════════════════════════════
// Async Handler Wrapper
// ═══════════════════════════════════════════════════════
// Express does NOT automatically catch errors from async
// route handlers. If an async handler throws, the error
// is silently swallowed and the request hangs forever.
//
// This wrapper catches async errors and forwards them
// to the global error handler via next(error).
//
// WITHOUT this wrapper:
//   router.get("/checks", async (req, res) => {
//     const checks = await getChecks(); // If this throws → request hangs
//   });
//
// WITH this wrapper:
//   router.get("/checks", asyncHandler(async (req, res) => {
//     const checks = await getChecks(); // If this throws → error handler catches it
//   }));
// ═══════════════════════════════════════════════════════

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**Why is this needed?** Express was designed before async/await existed. Its error handling expects synchronous `throw` or calling `next(error)`. When you use `async` route handlers, errors become rejected promises. Express does not catch rejected promises — they disappear silently, and the request hangs until the client times out. The `asyncHandler` wrapper converts rejected promises into `next(error)` calls, which Express's error handler catches.

---

## File 6: `src/middleware/request-id.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════
// Request ID Middleware
// ═══════════════════════════════════════════════════════
// Assigns a unique ID to every incoming request.
// This ID is:
// - Attached to the request object (for logging throughout the request lifecycle)
// - Included in the response headers (so the frontend can report it in bug reports)
// - Logged in every log line (so you can trace a request across all log entries)
//
// When a user reports "I got an error," they can provide the request ID
// from the response headers, and you can find every log line for that
// specific request instantly.
// ═══════════════════════════════════════════════════════

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();

  // Attach to request for use in logging and error handling
  req.requestId = requestId;

  // Include in response headers so the client can reference it
  res.setHeader("X-Request-Id", requestId);

  next();
}
```

---

## File 7: `src/middleware/request-logger.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { server } from "../config/index.js";

// ═══════════════════════════════════════════════════════
// Request Logger Middleware
// ═══════════════════════════════════════════════════════
// Logs every HTTP request with method, path, status code,
// and response time. Essential for debugging and monitoring.
//
// NEVER logs: passwords, tokens, bank account numbers,
// or any sensitive data from request/response bodies.
// ═══════════════════════════════════════════════════════

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log when the response finishes (not when the request arrives)
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      ip: req.ip,
    };

    // Color-code by status in development
    if (server.isDev) {
      const color = res.statusCode >= 500 ? "\x1b[31m"  // Red for 5xx
                  : res.statusCode >= 400 ? "\x1b[33m"  // Yellow for 4xx
                  : res.statusCode >= 300 ? "\x1b[36m"  // Cyan for 3xx
                  : "\x1b[32m";                          // Green for 2xx
      const reset = "\x1b[0m";

      console.log(
        `${color}${req.method}${reset} ${req.originalUrl} → ${color}${res.statusCode}${reset} (${duration}ms)`
      );
    } else {
      // In production, log as structured JSON for log aggregation tools
      console.log(JSON.stringify(logData));
    }
  });

  next();
}
```

**Why log on `res.on("finish")` instead of at the start?** Because we want to include the response status code and duration in the log. These are only known after the response is sent. If we logged at the start, we would know the request came in but not what happened to it.

**Why structured JSON in production?** Log aggregation tools (Datadog, CloudWatch, Better Stack) parse structured JSON automatically. They can index by `status`, filter by `method`, and alert on `duration > 1000ms`. Plain text logs require regex parsing, which is fragile and slow.

---

## File 8: `src/middleware/rate-limiter.ts`

```typescript
import rateLimit from "express-rate-limit";
import { rateLimit as rateLimitConfig } from "../config/index.js";

// ═══════════════════════════════════════════════════════
// Rate Limiter
// ═══════════════════════════════════════════════════════
// Prevents abuse by limiting how many requests a single
// IP can make within a time window.
//
// Default: 100 requests per minute per IP.
// Auth endpoints get stricter limits (defined per-route).
// ═══════════════════════════════════════════════════════

export const globalRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,       // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,        // Disable X-RateLimit-* headers (deprecated)
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  },
});

// Stricter rate limiter for auth endpoints
// (login, register — brute force protection)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts. Please try again in 15 minutes.",
    },
  },
});
```

---

## File 9: `src/middleware/validate.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../shared/errors/index.js";

// ═══════════════════════════════════════════════════════
// Validation Middleware Factory
// ═══════════════════════════════════════════════════════
// Creates middleware that validates req.body, req.query,
// or req.params against a Zod schema.
//
// Usage in routes:
//   router.post("/checks", validate(createCheckSchema), controller.create);
//
// If validation fails, throws ValidationError (400) with
// field-level error messages.
// ═══════════════════════════════════════════════════════

type ValidationTarget = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const formattedErrors: Record<string, string[]> = {};

      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (messages) {
          formattedErrors[field] = messages;
        }
      }

      throw new ValidationError("Validation failed", formattedErrors);
    }

    // Replace the original data with the validated + transformed data.
    // Zod may have applied transforms (string → number for PORT)
    // and stripped unknown fields.
    req[target] = result.data;
    next();
  };
}
```

---

## File 10: `src/middleware/not-found.ts`

```typescript
import { Request, Response, NextFunction } from "express";

// ═══════════════════════════════════════════════════════
// 404 Not Found Handler
// ═══════════════════════════════════════════════════════
// Catches requests that didn't match any route.
// Registered AFTER all routes but BEFORE the error handler.
// ═══════════════════════════════════════════════════════

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}
```

---

## File 11: `src/middleware/error-handler.ts`

The most critical middleware in the entire application.

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/index.js";
import { ValidationError } from "../shared/errors/index.js";
import { server } from "../config/index.js";

// ═══════════════════════════════════════════════════════
// Global Error Handler
// ═══════════════════════════════════════════════════════
// This is the LAST middleware registered. It catches every
// error thrown by every route handler and middleware above it.
//
// It distinguishes between:
// - Operational errors (expected: validation, not found, forbidden)
//   → Returns clear error message to client
// - Programming errors (bugs: null reference, type error)
//   → Returns generic message, logs details server-side
//
// MUST have exactly 4 parameters (err, req, res, next)
// for Express to recognize it as an error handler.
// ═══════════════════════════════════════════════════════

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction  // Must be declared even if unused
): void {

  // ─── Handle our custom AppError instances ───
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };

    // Include validation field errors if present
    if (err instanceof ValidationError && err.details) {
      (response.error as Record<string, unknown>).details = err.details;
    }

    // Include stack trace in development only
    if (server.isDev) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // ─── Handle unexpected errors (bugs) ───
  // Log the full error server-side for debugging
  console.error("╔═══════════════════════════════════════════╗");
  console.error("║  UNHANDLED ERROR                          ║");
  console.error("╚═══════════════════════════════════════════╝");
  console.error("Request:", req.method, req.originalUrl);
  console.error("Request ID:", req.requestId);
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);

  // Return a generic message to the client.
  // NEVER expose internal error details, stack traces,
  // or database errors to the client — it's a security risk.
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
      ...(server.isDev && { stack: err.stack, originalMessage: err.message }),
    },
  });
}
```

**Why 4 parameters?** Express distinguishes error-handling middleware from regular middleware by the number of parameters. Regular middleware has 3 (`req, res, next`). Error-handling middleware has 4 (`err, req, res, next`). If you write an error handler with only 3 parameters, Express treats it as regular middleware and errors skip it. This is one of the most subtle Express gotchas — many developers have spent hours wondering why their error handler never fires, only to discover they forgot the fourth parameter.

---

## File 12: `src/shared/types/express.d.ts`

This file extends Express's built-in type definitions to include our custom properties.

```typescript
// ═══════════════════════════════════════════════════════
// Express Type Extensions
// ═══════════════════════════════════════════════════════
// We attach custom properties to the Request object
// in our middleware (user, workspace, permissions, requestId).
// TypeScript needs to know about these properties.
// ═══════════════════════════════════════════════════════

declare namespace Express {
  interface Request {
    /** Unique request identifier for tracing */
    requestId: string;

    /** Authenticated user (set by auth middleware) */
    user?: {
      userId: string;
      tenantId: string;
      email: string;
    };

    /** Current workspace context (set by workspace middleware) */
    workspace?: {
      id: string;
      tenantId: string;
      businessName: string;
    };

    /** User's permissions in the current workspace (set by workspace middleware) */
    permissions?: {
      isSuperUser: boolean;
      canCreate: boolean;
      canPrint: boolean;
      canApprove: boolean;
    };
  }
}
```

**Why `declare namespace Express`?** Express is a JavaScript library with type definitions from `@types/express`. To add our own properties to the `Request` interface, we use TypeScript's "declaration merging" — we re-open the `Express` namespace and add new properties to the `Request` interface. TypeScript merges our additions with the original definition, so `req.user` and `req.requestId` are recognized everywhere without type errors.

---

## File 13: `src/app.ts`

The Express application factory. Creates and configures the app without starting the server.

```typescript
import express, { type Express } from "express";
import corsMiddleware from "cors";
import helmet from "helmet";
import { cors as corsConfig } from "./config/index.js";
import { globalRateLimiter } from "./middleware/rate-limiter.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

// ═══════════════════════════════════════════════════════
// Express Application Factory
// ═══════════════════════════════════════════════════════
// Creates and configures the Express app.
// Does NOT start listening — that's server.ts's job.
//
// Why a factory function instead of a module-level export?
// Because tests need to create fresh app instances.
// If the app were created at module level, every test
// would share the same instance (and its state).
// ═══════════════════════════════════════════════════════

export function createApp(): Express {
  const app = express();

  // ═══════════════════════════════════════════════════
  // MIDDLEWARE PIPELINE — Order matters!
  // ═══════════════════════════════════════════════════

  // 1. CORS — Must be first. If CORS rejects the request,
  //    no other middleware should waste time processing it.
  app.use(corsMiddleware({
    origin: corsConfig.origin,
    credentials: true,            // Allow cookies (for JWT in HTTP-only cookie)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // 2. Security Headers — Helmet sets headers like
  //    X-Content-Type-Options, X-Frame-Options, etc.
  //    Prevents clickjacking, MIME sniffing, and other attacks.
  app.use(helmet());

  // 3. Rate Limiting — Reject abusive IPs before they
  //    hit our business logic or database.
  app.use(globalRateLimiter);

  // 4. Body Parsing — Parse JSON request bodies.
  //    Limit size to 10MB to prevent memory exhaustion attacks.
  app.use(express.json({ limit: "10mb" }));

  // 5. URL-encoded parsing — For form submissions.
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 6. Request ID — Assign a unique ID to every request.
  app.use(requestIdMiddleware);

  // 7. Request Logger — Log every request after it completes.
  app.use(requestLoggerMiddleware);

  // ═══════════════════════════════════════════════════
  // ROUTES
  // ═══════════════════════════════════════════════════

  // Health check — public, no auth required.
  // Used by load balancers, uptime monitors, and deployment
  // systems to verify the server is alive.
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  });

  // API routes will be mounted here as we build modules:
  // app.use("/api/v1/auth", authRouter);
  // app.use("/api/v1/workspaces", workspaceRouter);
  // etc.

  // ═══════════════════════════════════════════════════
  // ERROR HANDLING — Must be registered LAST
  // ═══════════════════════════════════════════════════

  // 404 handler — catches requests that didn't match any route.
  // Must be AFTER all routes but BEFORE the error handler.
  app.use(notFoundHandler);

  // Global error handler — catches all errors thrown above.
  // MUST be the very last app.use() call.
  // MUST have 4 parameters for Express to recognize it.
  app.use(errorHandler);

  return app;
}
```

**Why `createApp()` is a function, not a direct export?** Two reasons. First, tests need isolated app instances. If every test imports the same app object, they share middleware state (like rate limiter counters) and interfere with each other. A factory function creates a fresh app for each test. Second, it makes the startup sequence explicit — the app is created when we call the function, not when the module is imported. This matters when modules have side effects.

**Why health check is registered BEFORE auth middleware?** The health check must be accessible without authentication. Load balancers (AWS ALB, Railway, Render) hit this endpoint every 30 seconds to verify the server is alive. If it requires auth, the load balancer cannot check health and might incorrectly mark the server as dead.

---

## File 14: `src/server.ts`

The entry point. Connects to the database, starts the HTTP server, and handles graceful shutdown.

```typescript
import { config, server as serverConfig, db } from "./config/index.js";
import { createApp } from "./app.js";
import { prisma } from "@smartbusiness/database";

// ═══════════════════════════════════════════════════════
// Server Entry Point
// ═══════════════════════════════════════════════════════
// This file:
// 1. Verifies the database connection
// 2. Creates and starts the HTTP server
// 3. Handles graceful shutdown on process signals
//
// It is the thinnest possible entry point.
// All app configuration is in app.ts.
// All config validation is in config/.
// This file only orchestrates startup and shutdown.
// ═══════════════════════════════════════════════════════

async function startServer(): Promise<void> {
  try {
    // ─── Step 1: Verify database connection ───
    console.log("🔌 Connecting to database...");
    await prisma.$queryRawUnsafe("SELECT 1");
    console.log("✅ Database connected\n");

    // ─── Step 2: Create Express app ───
    const app = createApp();

    // ─── Step 3: Start HTTP server ───
    const httpServer = app.listen(serverConfig.port, () => {
      console.log("╔═══════════════════════════════════════════╗");
      console.log(`║  🚀 Server running on port ${serverConfig.port}             ║`);
      console.log(`║  📍 http://localhost:${serverConfig.port}                ║`);
      console.log(`║  🌍 Environment: ${serverConfig.nodeEnv.padEnd(21)}║`);
      console.log("╚═══════════════════════════════════════════╝\n");
    });

    // ─── Step 4: Graceful shutdown ───
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections.
      // Existing connections are allowed to finish.
      httpServer.close(() => {
        console.log("  ✅ HTTP server closed");
      });

      // Disconnect from the database.
      // This closes the connection pool and releases all connections.
      try {
        await prisma.$disconnect();
        console.log("  ✅ Database disconnected");
      } catch (err) {
        console.error("  ❌ Error disconnecting database:", err);
      }

      console.log("👋 Shutdown complete. Goodbye.\n");
      process.exit(0);
    };

    // SIGTERM — sent by Docker, Kubernetes, Railway, Render
    // when they want the process to stop (deployment, scaling).
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // SIGINT — sent when you press Ctrl+C in the terminal.
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Unhandled Promise Rejections — an async function threw
    // an error that was never caught. This is always a bug.
    process.on("unhandledRejection", (reason: unknown) => {
      console.error("╔═══════════════════════════════════════════╗");
      console.error("║  UNHANDLED PROMISE REJECTION              ║");
      console.error("╚═══════════════════════════════════════════╝");
      console.error(reason);
      shutdown("unhandledRejection");
    });

    // Uncaught Exceptions — a synchronous error was thrown
    // outside of any try-catch. This is always a bug.
    process.on("uncaughtException", (error: Error) => {
      console.error("╔═══════════════════════════════════════════╗");
      console.error("║  UNCAUGHT EXCEPTION                       ║");
      console.error("╚═══════════════════════════════════════════╝");
      console.error(error);
      shutdown("uncaughtException");
    });

  } catch (error) {
    // If startup itself fails (database unreachable, port in use),
    // log the error and exit immediately. Do not retry — fix the
    // configuration and restart manually.
    console.error("╔═══════════════════════════════════════════╗");
    console.error("║  FATAL: Server failed to start            ║");
    console.error("╚═══════════════════════════════════════════╝");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Start the server
startServer();
```

**Why graceful shutdown matters:** Without graceful shutdown, when you deploy a new version (or press Ctrl+C), the process is killed immediately. Any in-flight requests are dropped — a user who clicked "Print Check" might get a half-generated PDF. Database connections are abandoned — PostgreSQL keeps them open until its own timeout, potentially reaching the connection limit. Graceful shutdown says "stop accepting NEW requests, finish EXISTING requests, close database connections cleanly, THEN exit." This is how zero-downtime deployments work.

**Why `SIGTERM` specifically?** When Docker/Kubernetes/Railway wants to stop your container, it sends `SIGTERM` first. If the process does not exit within a timeout (usually 30 seconds), it sends `SIGKILL` (which cannot be caught — the process dies immediately). By handling `SIGTERM`, we get those 30 seconds to finish in-flight requests and close connections cleanly.

**Why handle `unhandledRejection` and `uncaughtException`?** These are bugs in our code — promises without `.catch()` or `throw` statements outside try-catch blocks. In Node.js, unhandled rejections will eventually cause the process to crash (future Node versions make this the default). By catching them, we log the full error (for debugging) and shut down gracefully (to avoid data corruption from a half-crashed process). The fix is always to find and fix the bug, but the handler ensures the crash is clean and diagnosable.

---

## File 15: `.env.example`

```env
# ═══════════════════════════════════════════════════════
# SmartBusiness Check Printing API — Environment Variables
# ═══════════════════════════════════════════════════════
# Copy this file to .env and fill in the values.
# NEVER commit .env to Git — it contains secrets.
# ═══════════════════════════════════════════════════════

# Server
NODE_ENV=development
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartbusiness_dev

# JWT Authentication
JWT_SECRET=your-development-secret-must-be-at-least-32-chars
JWT_EXPIRES_IN=7d

# Encryption (AES-256 — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
CORS_ORIGIN=http://localhost:5173

# S3/R2 Storage (optional for local dev)
# S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
# S3_BUCKET=smartbusiness-dev
# S3_ACCESS_KEY_ID=your-access-key
# S3_SECRET_ACCESS_KEY=your-secret-key
# S3_REGION=auto

# Email (optional for local dev)
# RESEND_API_KEY=re_your-api-key
# EMAIL_FROM=noreply@smartbusiness.dev

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

---

# PART 4: HOW TO VERIFY IT WORKS

After implementing all files, run from the API app directory:

```bash
pnpm dev
```

You should see:

```
🔌 Connecting to database...
✅ Database connected

╔═══════════════════════════════════════════════════════╗
║  🚀 Server running on port 3000                      ║
║  📍 http://localhost:3000                             ║
║  🌍 Environment: development                         ║
╚═══════════════════════════════════════════════════════╝
```

Then test the health endpoint:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-09-12T14:30:00.000Z",
    "uptime": 3.456
  }
}
```

Then test the 404 handler:

```bash
curl http://localhost:3000/api/v1/nonexistent
```

Expected response:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /api/v1/nonexistent not found"
  }
}
```

Then test graceful shutdown: press Ctrl+C in the terminal. You should see:

```
⚠️  Received SIGINT. Starting graceful shutdown...
  ✅ HTTP server closed
  ✅ Database disconnected
👋 Shutdown complete. Goodbye.
```

If all four tests pass, your foundation is solid.

---

# PART 5: THE DEPENDENCY INSTALLATION CHECKLIST

Before any of this code works, the API app needs these dependencies. Run from inside `apps/check-printing-api/`:

```bash
# Production dependencies
pnpm add express cors helmet express-rate-limit dotenv zod

# Dev dependencies
pnpm add -D @types/express @types/cors typescript tsx @types/node

# Workspace dependency (our Prisma package)
pnpm add @smartbusiness/database --workspace
```

And update `package.json` scripts:

```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "check-types": "tsc --noEmit"
}
```

---

This document is your reusable blueprint. The patterns — config validation with Zod, layered middleware pipeline, custom error classes, async handler wrapper, graceful shutdown — apply to every Express.js project you will ever build. The specific environment variables and routes change, but the architecture is universal.
