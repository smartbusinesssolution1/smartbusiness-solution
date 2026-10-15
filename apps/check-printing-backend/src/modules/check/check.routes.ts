import { Router } from "express";
import { CheckRepository } from "./check.repository.js";
import { CheckService } from "./check.service.js";
import { CheckController } from "./check.controller.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { validate } from "../../middleware/validate.js";
import { requireAnyPermission, requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { idempotency } from "../../middleware/idempotency.js";
import { pdfService } from "../pdf/index.js";
import { calibrationService } from "../calibration/calibration.routes.js";
import { encryptionService } from "../../shared/services/encryption.service.js";
import { fileStorage } from "../../shared/storage/instance.js";
import {
  createCheckSchema,
  updateCheckSchema,
  rejectCheckSchema,
  voidCheckSchema,
  printOutcomeSchema,
  clearCheckSchema,
  listChecksQuerySchema,
  printCheckSchema,
} from "./check.schemas.js";

// ═════════════════════════════════════════════════════════════
// COMPOSITION ROOT
// ═════════════════════════════════════════════════════════════

const checkRepository = new CheckRepository();
const auditService = new AuditService();
const checkService = new CheckService(
  checkRepository,
  auditService,
  pdfService,
  calibrationService,
  encryptionService,
  fileStorage,
);
const checkController = new CheckController(checkService);

// ═════════════════════════════════════════════════════════════
// ROUTER
//
// mergeParams: true — Essential. This router is mounted at
// /:wid/checks inside workspace.routes.ts. Without mergeParams,
// req.params.wid would be undefined in our handlers.
//
// This router does NOT apply auth/tenant/product/workspace
// middleware — those are already applied by the parent router.
// ═════════════════════════════════════════════════════════════

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

// ── Approval Queue (BEFORE /:checkId to avoid param capture) ──
router.get(
  "/approval-queue",
  requirePermission(P.CHECK_APPROVE),
  checkController.approvalQueue,
);

// ── List / Search Checks ──
router.get(
  "/",
  validate(listChecksQuerySchema, "query"),
  checkController.list,
);

// ── Create Check ──
// idempotency() is placed FIRST so duplicate requests are caught
// before permission checks, validation, or service logic run.
// If no Idempotency-Key header is sent, the middleware is a no-op.
router.post(
  "/",
  requirePermission(P.CHECK_CREATE),
  idempotency(),
  validate(createCheckSchema),
  checkController.create,
);

// ── Get Single Check ──
router.get("/:checkId", checkController.getOne);

// ── Update Check (edit draft) ──
router.put(
  "/:checkId",
  requirePermission(P.CHECK_CREATE),
  validate(updateCheckSchema),
  checkController.update,
);

// ── Delete Draft Check ──
router.delete(
  "/:checkId",
  requirePermission(P.CHECK_CREATE),
  checkController.delete,
);

// ── Submit for Approval ──
router.post(
  "/:checkId/submit",
  requirePermission(P.CHECK_CREATE),
  checkController.submitForApproval,
);

// ── Approve Check ──
router.post(
  "/:checkId/approve",
  requirePermission(P.CHECK_APPROVE),
  checkController.approve,
);

// ── Reject Check ──
router.post(
  "/:checkId/reject",
  requirePermission(P.CHECK_APPROVE),
  validate(rejectCheckSchema),
  checkController.reject,
);

// ── Resubmit Check ──
router.post(
  "/:checkId/resubmit",
  requirePermission(P.CHECK_CREATE),
  checkController.resubmit,
);

// ── Print Check (generate PDF + transition to PRINTED) ──
router.post(
  "/:checkId/print",
  requirePermission(P.CHECK_PRINT),
  idempotency(),
  validate(printCheckSchema),
  checkController.printCheck,
);

// ── Download Check PDF ──
router.get(
  "/:checkId/pdf",
  requirePermission(P.CHECK_PRINT),
  checkController.downloadPdf,
);

// ── Report what came out of the printer (OK / SPOILED) ──
router.post(
  "/:checkId/print-outcome",
  requirePermission(P.CHECK_PRINT),
  validate(printOutcomeSchema),
  checkController.printOutcome,
);

// ── Void Check ──
// Admins (void permission) can void any check. Creators may withdraw their own
// UNPRINTED check; the service decides, because it knows the status and the creator.
router.post(
  "/:checkId/void",
  requireAnyPermission(P.CHECK_VOID, P.CHECK_CREATE),
  validate(voidCheckSchema),
  checkController.voidCheck,
);

// ── Mark as Cleared ──
router.post(
  "/:checkId/clear",
  requirePermission(P.CHECK_VOID),
  validate(clearCheckSchema),
  checkController.markCleared,
);

// ── Reissue Check ──
router.post(
  "/:checkId/reissue",
  requirePermission(P.CHECK_CREATE),
  checkController.reissue,
);

export { router as checkRouter };
