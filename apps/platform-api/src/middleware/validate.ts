import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

type ValidationTarget = "body" | "query" | "params";

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = "VALIDATION_ERROR";
  public readonly isOperational = true;
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message);
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function validate(
  schema: z.ZodType,
  target: ValidationTarget = "body",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors;
      const formattedErrors: Record<string, string[]> = {};

      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (Array.isArray(messages)) {
          formattedErrors[field] = messages;
        }
      }

      throw new ValidationError("Validation Failed", formattedErrors);
    }

    req[target] = result.data;
    next();
  };
}
