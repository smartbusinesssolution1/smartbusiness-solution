import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/index.js";
import { SIGNATURE_LIMITS } from "./signature-image.js";

// Reads one uploaded file ("signature" field) into memory, with hard limits applied
// while the upload is still arriving: an oversized upload is cut off at 5 MB, not
// read in full first. Nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SIGNATURE_LIMITS.maxBytes, files: 1, fields: 5, parts: 7, fieldSize: 1024 },
}).single("signature");

export function signatureUpload(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("The signature image must be 5 MB or smaller.", 413, "PAYLOAD_TOO_LARGE"));
      }
      return next(new AppError(`Invalid upload: ${err.message}. Send one image in the "signature" field.`, 400, "INVALID_UPLOAD"));
    }
    next(err);
  });
}
