import { Router } from "express";
import { LeaveRepository } from "./leave.repository.js";
import { LeaveService } from "./leave.service.js";
import { LeaveController } from "./leave.controller.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";
import { uploadLeaveDocument } from "../../middlewares/upload.middleware.js";

const repo = new LeaveRepository();
const service = new LeaveService(repo);
const controller = new LeaveController(service);

const router: Router = Router();

// ─── Policies ────────────────────────────────────────────────────────────────
router.get("/policies", controller.listPolicies);
router.get("/policies/:id", controller.getPolicyById);
router.post("/policies", requireAdmin, controller.createPolicy);
router.put("/policies/:id", requireAdmin, controller.updatePolicy);
router.delete("/policies/:id", requireAdmin, controller.deletePolicy);
router.post("/policies/seed-us-presets", requireAdmin, controller.seedUsPresets);

// ─── Balances & Accrual Engine ───────────────────────────────────────────────
router.get("/balances/my", controller.getMyBalances);
router.get("/balances/employee/:employeeId", requireAdmin, controller.getEmployeeBalances);
router.get("/balances/summary", requireAdmin, controller.listWorkspaceBalances);
router.post("/balances/assign", requireAdmin, controller.assignLeaveBalance);
router.post("/accruals/run-pay-period", requireAdmin, controller.runPayPeriodAccruals);
router.post("/accruals/run-rollover", requireAdmin, controller.runRollover);

// ─── Team Calendar & Conflict Detection ────────────────────────────────────
router.get("/calendar", controller.getTeamCalendar);
router.get("/departments", controller.listDepartments);
router.get("/conflict-check", controller.checkStaffingConflict);
router.get("/requests/:id/conflict-check", controller.checkStaffingConflict);

// ─── US Statutory Compliance & Payroll Exports ────────────────────────────────
router.get("/termination-payout", requireAdmin, controller.calculateTerminationPayout);
router.get("/payroll-export", requireAdmin, controller.getPayrollExport);

// ─── Leave Requests ──────────────────────────────────────────────────────────
router.post("/upload-document", uploadLeaveDocument.single("file"), controller.uploadAttachment);
router.post("/requests", controller.submitRequest);
router.get("/requests/my", controller.getMyRequests);
router.get("/requests", requireAdmin, controller.listRequests);
router.patch("/requests/:id/review", requireAdmin, controller.reviewRequest);
router.post("/requests/:id/cancel", controller.cancelRequest);

export default router;
