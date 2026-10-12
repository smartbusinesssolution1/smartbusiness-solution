import { NextFunction, Request, Response } from "express";
import { AppError, ValidationError } from "../shared/errors/index.js";
import { env } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
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

    if (env.server.isDev) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    res.status(err.statusCode).json(response);
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
      ...(env.server.isDev && { stack: err.stack, originalMessage: err.message }),
    },
  });
}
