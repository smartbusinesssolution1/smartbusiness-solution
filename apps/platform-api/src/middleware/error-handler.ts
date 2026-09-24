import type { NextFunction, Request, Response } from "express";
import { AppError } from "@smartbusiness/auth";
import { server } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError && err.isOperational) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (server.isDev) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    res.status(err.statusCode).json(response);
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
