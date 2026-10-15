import multer from "multer";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../shared/errors/index.js";

// Reads ONE uploaded file from `field` into memory, with limits enforced while the
// upload is still arriving: an oversized file is cut off at `maxBytes`, not read in
// full first. Nothing is written to disk.
export function singleFileUpload(field: string, maxBytes: number, sizeLabel: string): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 5, parts: 7, fieldSize: 1024 },
  }).single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError(`The file must be ${sizeLabel} or smaller.`, 413, "PAYLOAD_TOO_LARGE"));
        }
        return next(new AppError(`Invalid upload: ${err.message}. Send one file in the "${field}" field.`, 400, "INVALID_UPLOAD"));
      }
      next(err);
    });
  };
}
