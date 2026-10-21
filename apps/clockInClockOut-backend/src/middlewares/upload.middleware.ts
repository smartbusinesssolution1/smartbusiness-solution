import multer from "multer";
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

