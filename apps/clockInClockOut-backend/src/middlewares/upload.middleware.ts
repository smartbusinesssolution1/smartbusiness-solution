import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/index.js";

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
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
 * Accepts 'selfie' (single) or 'selfies' / 'capture_images' (burst frames)
 * Assigns primary frame to req.file and preserves all burst frames in req.captureFiles.
 */
export const uploadSelfie = (req: Request, res: Response, next: NextFunction) => {
  uploadAvatar.fields([
    { name: "selfie", maxCount: 1 },
    { name: "selfies", maxCount: 10 },
    { name: "capture_images", maxCount: 10 },
  ])(req, res, (err) => {
    if (err) return next(err);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      const burstList = files.selfies || files.capture_images;
      if (burstList && burstList.length > 0) {
        (req as any).captureFiles = burstList;
        req.file = burstList[burstList.length - 1];
      } else if (files.selfie && files.selfie.length > 0) {
        (req as any).captureFiles = files.selfie;
        req.file = files.selfie[0];
      }
    }

    next();
  });
};
