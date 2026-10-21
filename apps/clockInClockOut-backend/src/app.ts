import express, { type Express } from "express";
import corsMiddleware from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config";
import { globalRateLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { requestID } from "./middlewares/requestID";
import { apiV1 } from "./routes";
import { UPLOADS_DIR } from "./shared/utils/uploadDir.js";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { errorHandler } from "./middlewares/errorHandler";

export function createApp(): Express {
    const app = express();

    app.set("trust proxy", 1);

    app.use(corsMiddleware({
        // Exact origins only (env.schema refuses "*"): the session is in cookies, so allowing any
        // website with credentials would let it act as the signed-in user and read the answers.
        origin: env.server.origin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "X-Tenant-Id", "X-Workspace-Id"],
    }));
    app.use(helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        },
    }));
    app.use(globalRateLimiter);
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({
        extended: true,
        limit: "10mb",
    }));
    app.use(cookieParser());
    app.use( // RequestID must always be after RequestLogger
        requestLogger, // Structured request logging (pino-http) — generates reqId + auto-logs completion
        requestID // Bridge pino-http's req.id to req.requestId + X-Request-Id response header
    );

    // ─── Static Uploads ──────────────────────────────
    app.use("/uploads", express.static(UPLOADS_DIR));

    // ─── API Versioning ───────────────────────────────
    app.use("/api/v1", apiV1);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}