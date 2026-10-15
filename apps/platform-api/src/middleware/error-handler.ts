import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@smartbusiness/database";
import { AppError } from "@smartbusiness/auth";
import { ValidationError } from "../shared/errors/index.js";
import { server } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

interface MappedError {
  status: number;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

// Infrastructure errors that are normal under load or bad input. Messages are generic
// on purpose: Prisma's own messages name tables and can contain request data.
const PRISMA_KNOWN_ERRORS: Record<string, MappedError> = {
  P2002: { status: 409, code: "CONFLICT", message: "This change conflicts with an existing record." },
  P2025: { status: 404, code: "NOT_FOUND", message: "The record was not found." },
  P2028: { status: 503, code: "SERVICE_BUSY", message: "The service is busy. Try again in a few seconds.", retryAfterSeconds: 5 },
  P2034: { status: 409, code: "CONFLICT", message: "This record was changed at the same time. Try again." },
  P2024: { status: 503, code: "SERVICE_BUSY", message: "The service is busy. Try again in a few seconds.", retryAfterSeconds: 5 },
};

const DATABASE_UNAVAILABLE: MappedError = {
  status: 503,
  code: "DATABASE_UNAVAILABLE",
  message: "The service is temporarily unavailable. Try again shortly.",
  retryAfterSeconds: 10,
};

// Errors raised by express.json() / express.urlencoded().
const BODY_PARSER_ERRORS: Record<string, MappedError> = {
  "entity.parse.failed": { status: 400, code: "INVALID_JSON", message: "The request body is not valid JSON." },
  "entity.too.large": { status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request body is too large." },
};

function mapKnownError(err: unknown): MappedError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code.startsWith("P1")) return DATABASE_UNAVAILABLE;
    return PRISMA_KNOWN_ERRORS[err.code] ?? null;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return DATABASE_UNAVAILABLE;
  const type = (err as { type?: unknown }).type;
  if (typeof type === "string" && type in BODY_PARSER_ERRORS) return BODY_PARSER_ERRORS[type]!;
  return null;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError && err.isOperational) {
    const error: Record<string, unknown> = { code: err.code, message: err.message };
    if (err instanceof ValidationError) error.details = err.details;
    if (server.isDev) error.stack = err.stack;

    res.status(err.statusCode).json({ success: false, error });
    return;
  }

  const mapped = mapKnownError(err);
  if (mapped) {
    logger.warn(
      { errCode: (err as { code?: string }).code, type: err.name, method: req.method, url: req.originalUrl, mappedTo: mapped.code },
      "Infrastructure error mapped to client response",
    );
    if (mapped.retryAfterSeconds) res.setHeader("Retry-After", String(mapped.retryAfterSeconds));
    res.status(mapped.status).json({ success: false, error: { code: mapped.code, message: mapped.message } });
    return;
  }

  logger.error(
    { err, method: req.method, url: req.originalUrl },
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
