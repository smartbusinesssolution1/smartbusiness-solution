import type { RequestHandler } from "express";
import { singleFileUpload } from "../../middleware/file-upload.js";
import { SIGNATURE_LIMITS } from "./signature-image.js";

// One image in the "signature" field, cut off at 5 MB while uploading.
export const signatureUpload: RequestHandler = singleFileUpload("signature", SIGNATURE_LIMITS.maxBytes, "5 MB");
