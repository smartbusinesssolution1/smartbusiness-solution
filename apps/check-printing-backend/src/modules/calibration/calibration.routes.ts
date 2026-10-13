import { Router } from "express";
import { requirePermission } from "../../middleware/permission.guard.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { pdfService } from "../pdf/index.js";

import { CalibrationRepository } from "./calibration.repository.js";
import { CalibrationService } from "./calibration.service.js";
import { CalibrationController } from "./calibration.controller.js";
import {
  adjustmentSchema,
  createCalibrationSchema,
  testPageQuerySchema,
  updateCalibrationSchema,
  verificationSchema,
} from "./calibration.schemas.js";

const calibrationRepository = new CalibrationRepository();
const auditService = new AuditService();
const calibrationService = new CalibrationService(calibrationRepository, auditService, pdfService);
const controller = new CalibrationController(calibrationService, pdfService);

const calibrationRouter: ReturnType<typeof Router> = Router({ mergeParams: true });

calibrationRouter.use(requirePermission(P.CHECK_PRINT));

// Static route BEFORE :id parameter
calibrationRouter.get(
  "/test-page",
  validate(testPageQuerySchema, "query"),
  controller.testPage,
);

calibrationRouter.post(
  "/",
  validate(createCalibrationSchema),
  controller.create,
);

calibrationRouter.get("/", controller.list);

calibrationRouter.get("/:id", controller.getOne);

calibrationRouter.put(
  "/:id",
  validate(updateCalibrationSchema),
  controller.update,
);

calibrationRouter.patch("/:id/default", controller.setDefault);

// Verification: print a VOID sample check with this profile, measure it, then
// confirm (or fine-adjust and print again).
calibrationRouter.get("/:id/verification-page", controller.verificationPage);

calibrationRouter.post(
  "/:id/verification",
  validate(verificationSchema),
  controller.verify,
);

calibrationRouter.post(
  "/:id/adjustment",
  validate(adjustmentSchema),
  controller.adjust,
);

calibrationRouter.delete("/:id", controller.remove);

export { calibrationRouter, calibrationService };
