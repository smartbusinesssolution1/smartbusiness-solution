import { Router } from "express";
import { AdminEmployeeRepository } from "./admin-employee.repository.js";
import { AdminEmployeeService } from "./admin-employee.service.js";
import { AdminEmployeeController } from "./admin-employee.controller.js";
import { requireAdmin } from "../../../middlewares/requireAdmin.js";
import { uploadAvatar } from "../../../middlewares/upload.middleware.js";

// Composition Root
const repo = new AdminEmployeeRepository();
const service = new AdminEmployeeService(repo);
const controller = new AdminEmployeeController(service);

const router: Router = Router();

// Restrict all routes to Organization Admins & Owners
router.use(requireAdmin);

// GET /api/v1/admin/employees - Directory listing with search & filters
router.get("/", controller.list);

// GET /api/v1/admin/employees/check-email - Check if email exists in tenant/workspace
router.get("/check-email", controller.checkEmail);

// GET /api/v1/admin/employees/:id - Retrieve single employee details
router.get("/:id", controller.get);

// POST /api/v1/admin/employees - Onboard employee with avatar & day-wise schedule
router.post("/", uploadAvatar.single("avatar"), controller.create);

// PUT /api/v1/admin/employees/:id - Update employee with optional new avatar
router.put("/:id", uploadAvatar.single("avatar"), controller.update);

// POST /api/v1/admin/employees/:id/resend-invitation - Email the employee their way in again
router.post("/:id/resend-invitation", controller.resendInvitation);

// DELETE /api/v1/admin/employees/:id - Remove employee
router.delete("/:id", controller.delete);

export default router;
