import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors/index.js";
import { EXPORT_FORMATS, type ExportFormat } from "./export-table.js";

// ?format=csv|xlsx|pdf on an export URL. It is taken out of the query before the
// endpoint's own schema runs, so an export accepts exactly the filters its list accepts
// (strict schemas refuse unknown names) and nothing else.
export function exportFormat() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { format, ...rest } = req.query as Record<string, unknown>;
    if (typeof format !== "string" || !EXPORT_FORMATS.includes(format as ExportFormat)) {
      throw new ValidationError("Validation Failed", { format: [`Choose one of: ${EXPORT_FORMATS.join(", ")}`] });
    }
    res.locals.exportFormat = format;
    // Express 5 exposes req.query as a getter, so it is redefined, not assigned.
    Object.defineProperty(req, "query", { value: rest, writable: true, configurable: true, enumerable: true });
    next();
  };
}
