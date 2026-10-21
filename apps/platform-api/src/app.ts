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
import apiRouter from "./routes/index.js";
import { producerConnection } from "./jobs/queues.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    corsMiddleware({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if ((corsConfig.origin as readonly string[]).includes(requestOrigin)) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV !== "production") {
          try {
            const url = new URL(requestOrigin);
            if (
              url.hostname === "localhost" ||
              url.hostname === "127.0.0.1" ||
              url.hostname.startsWith("192.168.") ||
              url.hostname.startsWith("10.") ||
              url.hostname.startsWith("172.")
            ) {
              return callback(null, true);
            }
          } catch {}
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Id", "X-Workspace-Id", "Platform", "platform", "X-Platform", "x-platform"],
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(globalRateLimiter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use(requestLoggerMiddleware);
  app.use(requestIdMiddleware);

  app.get("/api/v1/health", async (_req: Request, res: Response) => {
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

    let isRedisOk = false;
    try {
      isRedisOk = (await producerConnection.ping()) === "PONG";
    } catch {
      isRedisOk = false;
    }

    const status = isDatabaseOk && isRedisOk ? "healthy" : "degraded";
    const httpStatus = isDatabaseOk && isRedisOk ? 200 : 503;

    res.status(httpStatus).json({
      success: isDatabaseOk && isRedisOk,
      data: {
        status,
        service: "platform-api",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: { connected: isDatabaseOk, latencyMs: dbLatencyMs },
        jobQueue: { connected: isRedisOk },
      },
    });
  });

  app.use("/api/v1", apiRouter);
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
