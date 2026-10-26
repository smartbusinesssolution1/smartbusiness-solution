import express, { type Express, type Request, type Response } from "express";
import corsMiddleware from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { cors as corsConfig } from "./config/index.js";
import { globalRateLimiter } from "./middleware/rate-limiter.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { prisma } from "@smartbusiness/database";
import { createOriginGuard } from "@smartbusiness/auth";
import { logger } from "./shared/services/logger.js";
import apiRouter from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  // CORS is what the BROWSER is told it may do; curl and server-to-server calls ignore it.
  // Before a cross-origin request with custom headers the browser asks (a preflight), and a
  // header missing from allowedHeaders makes it cancel the request without sending it.
  app.use(
    corsMiddleware({
      // Exact origins from CORS_ORIGIN; the request's Origin is echoed only if it is listed.
      origin: corsConfig.origin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      // Idempotency-Key: the duplicate protection on creating and printing checks.
      // X-Request-Id: lets the app tag its own requests so logs can be matched to them.
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Id", "Idempotency-Key", "X-Request-Id"],
      // Response headers the app's JavaScript may read (only a few basic ones are readable otherwise).
      exposedHeaders: ["X-Request-Id", "Idempotent-Replayed", "Retry-After", "Content-Disposition"],
      // The browser may reuse a preflight answer for 10 minutes instead of asking before every request.
      maxAge: 600,
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // CSRF: a change requested by a page on a website we don't serve is refused before
  // anything is read (and before it can use up the visitor's rate limit). Same list as CORS.
  app.use(createOriginGuard({ isAllowedOrigin: (origin) => corsConfig.origin.includes(origin) }));

  app.use(globalRateLimiter);

  // The largest legitimate JSON body (a check with 50 invoice lines) is well under
  // 100 KB. File uploads, when added, get their own multipart limit per route.
  // inflate: false refuses compressed request bodies (Content-Encoding: gzip, ...) with a
  // 415 before any decompression starts. Browsers never compress what they send, and
  // body-parser before 2.4.0 crashes the whole process on a crafted compressed body
  // (GHSA-27r3-jxmh-p828).
  //
  // JSON only: no form-encoded parser. An HTML form on another site can post form data
  // without the browser asking first; JSON can't be sent cross-site without that question
  // (a preflight), which CORS refuses. Our app only ever sends JSON (and file uploads,
  // which their own routes read).
  app.use(express.json({ limit: "100kb", inflate: false }));
  app.use(cookieParser());

  // Structured request logging (pino-http) — generates reqId + auto-logs completion
  app.use(requestLoggerMiddleware);

  // Bridge pino-http's req.id to req.requestId + X-Request-Id response header
  app.use(requestIdMiddleware);

  // Public, for load balancers and uptime checks: healthy (200) or degraded (503), nothing
  // more. How long the server has run and how fast the database answers help an attacker
  // time an attack, and no health check needs them.
  app.get("/api/v1/health", async (_req: Request, res: Response) => {
    let isDatabaseOk = false;
    try {
      await prisma.$executeRawUnsafe("SELECT 1");
      isDatabaseOk = true;
    } catch {
      isDatabaseOk = false;
    }

    res.status(isDatabaseOk ? 200 : 503).json({
      success: isDatabaseOk,
      data: {
        status: isDatabaseOk ? "healthy" : "degraded",
        database: { connected: isDatabaseOk },
      },
    });
  });

  // ─── API Routes ────────────────────────────────────────────
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
