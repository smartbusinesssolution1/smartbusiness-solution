import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "../shared/errors/index.js";

type ValidationTarget = "body" | "query" | "params";

export function validate(schema: z.ZodType, target: ValidationTarget = "body") {
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

    if (target === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      req[target] = result.data;
    }
    next();
  };
}
