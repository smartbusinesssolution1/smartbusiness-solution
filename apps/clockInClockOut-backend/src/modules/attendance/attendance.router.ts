import { Router } from "express";
import { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceController } from "./attendance.controller.js";
import { validate } from "../../middlewares/validate.js";
import { uploadSelfie } from "../../middlewares/upload.middleware.js";
import {
  VerifyLocationSchema,
  CheckInSchema,
  CheckOutSchema,
  AttendanceHistoryQuerySchema,
  LedgerExportSchema,
} from "./attendance.schema.js";

// Composition Root
const repo = new AttendanceRepository();
const service = new AttendanceService(repo);
const controller = new AttendanceController(service);

const router: Router = Router();

// ─── Attendance Endpoints ─────────────────────────

// POST /api/v1/attendance/verify-location - Step 1: Geofence verification
router.post(
  "/verify-location",
  validate(VerifyLocationSchema),
  controller.verifyLocation
);

// GET /api/v1/attendance/challenge - Step 1.5: Acquire active-liveness signed challenge token
router.get(
  "/challenge",
  controller.getChallenge
);

// POST /api/v1/attendance/check-in - Step 2: Biometric check-in punch
router.post(
  "/check-in",
  uploadSelfie,
  validate(CheckInSchema),
  controller.checkIn
);

// POST /api/v1/attendance/clock-in - Alias for mobile client compatibility
router.post(
  "/clock-in",
  uploadSelfie,
  validate(CheckInSchema),
  controller.checkIn
);

// GET /api/v1/attendance/today - Active shift status for today
router.get(
  "/today",
  controller.today
);

// POST /api/v1/attendance/check-out - Shift clock-out
router.post(
  "/check-out",
  validate(CheckOutSchema),
  controller.checkOut
);

// POST /api/v1/attendance/clock-out - Alias for mobile client compatibility
router.post(
  "/clock-out",
  validate(CheckOutSchema),
  controller.checkOut
);

// GET /api/v1/attendance/my/:employeeId/metrics - Employee dashboard metrics
router.get(
  "/my/:employeeId/metrics",
  controller.employeeDashboardMetrics
);

// GET /api/v1/attendance/my/:employeeId - Employee attendance records
router.get(
  "/my/:employeeId",
  controller.employeeAttendanceHistory
);

// GET /api/v1/attendance/history - Paginated attendance history
router.get(
  "/history",
  validate(AttendanceHistoryQuerySchema, "query"),
  controller.history
);

// GET /api/v1/attendance/metrics - Monthly summary metrics
router.get(
  "/metrics",
  controller.metrics
);

// POST /api/v1/attendance/ledger/export - Export attendance timesheet (CSV / PDF)
router.post(
  "/ledger/export",
  validate(LedgerExportSchema),
  controller.exportLedger
);

// GET /api/v1/attendance/records/:id - Forensic punch details
router.get(
  "/records/:id",
  controller.getRecord
);

export { router as attendanceRouter };
