import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "../shared/errors/index.js";

type ValidationTarget = "body" | "query" | "params";

export function validate(schema: z.ZodType, target: ValidationTarget = "body") {

    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[target]);

        if (!result.success) {
            const { fieldErrors, formErrors } = z.flattenError(result.error);

            const formattedErrors: Record<string, string[]> = {};

            for (const [field, messages] of Object.entries(fieldErrors)) {
                if (Array.isArray(messages)) {
                    formattedErrors[field] = messages
                }
            }

            // Errors about the request as a whole (e.g. an unknown filter name) have no field.
            if (formErrors.length > 0) {
                formattedErrors._errors = formErrors;
            }

            throw new ValidationError("Validation Failed", formattedErrors);
        }
        // Replace the original data with the validated + transformed data.
        // Express 5 exposes req.query as a getter-only property, so it must be redefined, not assigned.
        if (target === "query") {
            Object.defineProperty(req, "query", {
                value: result.data,
                writable: true,
                configurable: true,
                enumerable: true,
            });
        } else {
            req[target] = result.data;
        }
        next();
    }
}
