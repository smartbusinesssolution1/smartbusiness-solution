import { Router } from "express";
import { requirePermission } from "../../middleware/permission.guard.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { CheckPrintingSettingsRepository } from "./check-printing-settings.repository.js";
import { CheckPrintingSettingsService } from "./check-printing-settings.service.js";
import { CheckPrintingSettingsController } from "./check-printing-settings.controller.js";
import { updateCheckPrintingSettingsSchema } from "./check-printing-settings.schemas.js";

// ─── Composition Root ──────────────────────────────────────
// The service is exported: checks and approval rules read the same settings through it.

const checkPrintingSettingsService = new CheckPrintingSettingsService(
  new CheckPrintingSettingsRepository(),
  new AuditService(),
);
const controller = new CheckPrintingSettingsController(checkPrintingSettingsService);

// ─── Router ────────────────────────────────────────────────
// Mounted at /workspaces/:wid/check-printing-settings behind workspaceMiddleware.

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

// Every member may read the limits: the check form validates amounts and dates with them.
router.get("/", controller.get);

router.put(
  "/",
  requirePermission(P.WORKSPACE_MANAGE),
  validate(updateCheckPrintingSettingsSchema),
  controller.update,
);

export { router as checkPrintingSettingsRouter, checkPrintingSettingsService };
