import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { AppError, ValidationError } from "../shared/errors/index.js";
import { env } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Gracefully handle file upload errors (e.g. unexpected field, file size limit)
  if (err instanceof MulterError) {
    logger.warn(
      {
        code: err.code,
        field: err.field,
        message: err.message,
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
      },
      "File upload error (Multer)",
    );

    res.status(400).json({
      success: false,
      error: {
        code: "FILE_UPLOAD_ERROR",
        message: err.message,
        details: { field: err.field, code: err.code },
      },
    });
    return;
  }

  const isOperational =
    (err instanceof AppError && err.isOperational) ||
    (Boolean((err as any).isOperational) && typeof (err as any).statusCode === "number");

  if (isOperational) {
    const statusCode = (err as any).statusCode || 500;
    const code = (err as any).code || "APP_ERROR";

    const response: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details) {
      (response.error as Record<string, unknown>).details = err.details;
    } else if ((err as any).details) {
      (response.error as Record<string, unknown>).details = (err as any).details;
    }

    if (env.server.isDev) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    res.status(statusCode).json(response);
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
