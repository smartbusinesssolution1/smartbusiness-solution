import { NextFunction, Request, Response } from "express";
import { Prisma } from "@smartbusiness/database";
import { AppError, ValidationError } from "../shared/errors/index.js";
import { server } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

// ═══════════════════════════════════════════════════════════════
// KNOWN INFRASTRUCTURE ERRORS → CLEAR CLIENT RESPONSES
//
// Services translate the errors they expect into AppErrors. These
// mappings are the safety net for the rest: a unique-constraint
// race or a busy connection pool is a normal event under load and
// must reach the client as a retryable 409/503, not as a 500.
// Messages are generic on purpose: Prisma's own messages name
// tables and columns.
// ═══════════════════════════════════════════════════════════════

interface MappedError {
  status: number;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

const PRISMA_KNOWN_ERRORS: Record<string, MappedError> = {
  // Unique constraint failed
  P2002: {
    status: 409,
    code: "CONFLICT",
    message: "This change conflicts with an existing record. Refresh and try again.",
  },
  // Record required for the operation was not found
  P2025: {
    status: 404,
    code: "NOT_FOUND",
    message: "The record was not found. It may have been changed or deleted.",
  },
  // Transaction could not start or expired (pool exhausted, long lock wait)
  P2028: {
    status: 503,
    code: "SERVICE_BUSY",
    message: "The service is busy. Try again in a few seconds.",
    retryAfterSeconds: 5,
  },
  // Write conflict or deadlock
  P2034: {
    status: 409,
    code: "CONFLICT",
    message: "This record was changed by another request at the same time. Try again.",
  },
  // Timed out fetching a new connection from the pool
  P2024: {
    status: 503,
    code: "SERVICE_BUSY",
    message: "The service is busy. Try again in a few seconds.",
    retryAfterSeconds: 5,
  },
};

const DATABASE_UNAVAILABLE: MappedError = {
  status: 503,
  code: "DATABASE_UNAVAILABLE",
  message: "The database is temporarily unavailable. Try again shortly.",
  retryAfterSeconds: 10,
};

// Errors raised by express.json() / express.urlencoded() (body-parser).
const BODY_PARSER_ERRORS: Record<string, MappedError> = {
  "entity.parse.failed": {
    status: 400,
    code: "INVALID_JSON",
    message: "The request body is not valid JSON.",
  },
  "entity.too.large": {
    status: 413,
    code: "PAYLOAD_TOO_LARGE",
    message: "The request body is too large.",
  },
  "encoding.unsupported": {
    status: 415,
    code: "UNSUPPORTED_ENCODING",
    message: "The request body encoding is not supported.",
  },
  "charset.unsupported": {
    status: 415,
    code: "UNSUPPORTED_ENCODING",
    message: "The request body charset is not supported.",
  },
};

function mapKnownError(err: unknown): MappedError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code.startsWith("P1")) return DATABASE_UNAVAILABLE;
    return PRISMA_KNOWN_ERRORS[err.code] ?? null;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return DATABASE_UNAVAILABLE;
  }
  const type = (err as { type?: unknown }).type;
  if (typeof type === "string" && type in BODY_PARSER_ERRORS) {
    return BODY_PARSER_ERRORS[type]!;
  }
  return null;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    // The response is already streaming; Express can only close the connection.
    logger.error({ err, requestId: req.requestId }, "Error after response started");
    res.end();
    return;
  }

  if (err instanceof AppError && err.isOperational) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details) {
      (response.error as Record<string, unknown>).details = err.details;
    }

    if (server.isDev) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  const mapped = mapKnownError(err);
  if (mapped) {
    logger.warn(
      {
        err,
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        mappedTo: mapped.code,
      },
      "Infrastructure error mapped to client response",
    );

    if (mapped.retryAfterSeconds) {
      res.setHeader("Retry-After", String(mapped.retryAfterSeconds));
    }
    res.status(mapped.status).json({
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return;
  }

  logger.error(
    {
      err,
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
    },
    "Non-operational error",
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
      ...(server.isDev && { stack: err.stack, originalMessage: err.message }),
    },
  });
}
