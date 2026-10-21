import { Router } from "express";
import { AdminAttendanceRepository } from "./admin-attendance.repository.js";
import { AdminAttendanceService } from "./admin-attendance.service.js";
import { AdminAttendanceController } from "./admin-attendance.controller.js";
import { requireAdmin } from "../../../middlewares/requireAdmin.js";

// Composition Root
const repo = new AdminAttendanceRepository();
const service = new AdminAttendanceService(repo);
const controller = new AdminAttendanceController(service);

const router: Router = Router();

// Apply requireAdmin to all admin attendance routes
router.use(requireAdmin);

// GET /api/v1/admin/attendance - Full ledger with multi-workspace and date filters
router.get("/", controller.list);

// GET /api/v1/admin/attendance/summary - Organization attendance KPIs
router.get("/summary", controller.summary);

// POST /api/v1/admin/attendance/export - Generate and download audit reports (XLSX, CSV, PDF) on explicit user request
router.post("/export", controller.exportReport);

export default router;
