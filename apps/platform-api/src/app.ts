import express, { type Express, type Request, type Response } from "express";
import corsMiddleware from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { globalRateLimiter } from "./middleware/rate-limiter.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { prisma } from "@smartbusiness/database";
import { createOriginGuard } from "@smartbusiness/auth";
import apiRouter from "./routes/index.js";
import { producerConnection } from "./jobs/queues.js";

// Which websites count as ours (CORS, the origin guard, links in emails): one rule, kept in
// shared/utils so the auth module can use it without importing the app.
import { isAllowedOrigin } from "./shared/utils/allowed-origin.js";
export { isAllowedOrigin, isLocalNetworkOrigin } from "./shared/utils/allowed-origin.js";

// The mobile app announces itself with this header. A forged request can't carry it: a
// form can't set headers, and a script on another site can't send one without a preflight,
// which CORS refuses. Only the header counts, never `platform` in the body (a form can
// send that).
function sentByApp(req: Request): boolean {
  const header = req.headers["platform"] ?? req.headers["x-platform"];
  return typeof header === "string" && header.toLowerCase() === "app";
}

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    corsMiddleware({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        return callback(null, isAllowedOrigin(requestOrigin));
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

  // CSRF: a change requested by a page on a website we don't serve is refused before
  // anything is read (and before it can use up the visitor's rate limit). The mobile app
  // and server-to-server calls send no Origin and are unaffected.
  app.use(createOriginGuard({ isAllowedOrigin, exempt: sentByApp }));

  app.use(globalRateLimiter);

  // inflate: false refuses compressed request bodies (Content-Encoding: gzip, ...) with a
  // 415 before any decompression starts. Browsers and the mobile app never compress what
  // they send, and body-parser before 2.4.0 crashes the whole process on a crafted
  // compressed body (GHSA-27r3-jxmh-p828).
  app.use(express.json({ limit: "1mb", inflate: false }));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true, limit: "1mb", inflate: false }));

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
