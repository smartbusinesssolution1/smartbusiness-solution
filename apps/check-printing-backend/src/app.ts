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
import { logger } from "./shared/services/logger.js";
import apiRouter from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    corsMiddleware({
      origin: corsConfig.origin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Id"],
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(globalRateLimiter);

  // The largest legitimate JSON body (a check with 50 invoice lines) is well under
  // 100 KB. File uploads, when added, get their own multipart limit per route.
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  // Structured request logging (pino-http) — generates reqId + auto-logs completion
  app.use(requestLoggerMiddleware);

  // Bridge pino-http's req.id to req.requestId + X-Request-Id response header
  app.use(requestIdMiddleware);

  app.get("/api/v1/health", async (req: Request, res: Response) => {
    let dbLatencyMs: number | null = null;
    let isDatabaseOk = false;

    try {
      const dbStart = Date.now();
      await prisma.$executeRawUnsafe("SELECT 1");
      dbLatencyMs = Date.now() - dbStart;
      isDatabaseOk = true;
    } catch {
      isDatabaseOk = false;
    }

    const status = isDatabaseOk ? "healthy" : "degraded";
    const httpStatus = isDatabaseOk ? 200 : 503;

    res.status(httpStatus).json({
      success: isDatabaseOk,
      data: {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          connected: isDatabaseOk,
          latencyMs: dbLatencyMs,
        },
      },
    });
  });

  // ─── API Routes ────────────────────────────────────────────
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
