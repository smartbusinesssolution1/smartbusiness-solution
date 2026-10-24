import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/index.js";

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Only image files (JPEG, PNG, WEBP) are allowed.", 400, "INVALID_FILE_TYPE"));
    }
  },
});

/**
 * Flexible upload middleware for attendance check-in:
 * Accepts 'selfie' (single) or 'selfies' (single or array of burst frames)
 * and assigns the selected punch image to req.file.
 */
export const uploadSelfie = (req: Request, res: Response, next: NextFunction) => {
  uploadAvatar.fields([
    { name: "selfie", maxCount: 1 },
    { name: "selfies", maxCount: 10 },
  ])(req, res, (err) => {
    if (err) return next(err);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files.selfie && files.selfie.length > 0) {
        req.file = files.selfie[0];
      } else if (files.selfies && files.selfies.length > 0) {
        req.file = files.selfies[files.selfies.length - 1];
      }
    }

    next();
  });
};
