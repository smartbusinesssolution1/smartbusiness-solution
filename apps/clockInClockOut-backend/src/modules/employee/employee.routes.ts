import { Router } from "express";
import { EmployeeRepository } from "./employee.repository.js";
import { EmployeeService } from "./employee.service.js";
import { EmployeeController } from "./employee.controller.js";
import { validate } from "../../middlewares/validate.js";
import { uploadAvatar } from "../../middlewares/upload.middleware.js";
import { UpdateProfileSchema, RegisterPushTokenSchema } from "./employee.schema.js";
import { attendanceRouter } from "../attendance/attendance.router.js";

// Composition Root
const employeeRepo = new EmployeeRepository();
const employeeService = new EmployeeService(employeeRepo);
const employeeController = new EmployeeController(employeeService);

const router: Router = Router();

// Routes

// GET /api/v1/employees/me - Retrieve authenticated employee profile & assigned workspaces
router.get("/me", employeeController.getMe);

// PUT /api/v1/employees/me - Update personal contact info & profile
router.put("/me", validate(UpdateProfileSchema), employeeController.updateMe);

// PATCH /api/v1/employees/me - Partial profile update
router.patch("/me", validate(UpdateProfileSchema), employeeController.updateMe);

// POST /api/v1/employees/me/avatar - Upload baseline facial portrait (Image 2)
router.post("/me/avatar", uploadAvatar.single("avatar"), employeeController.uploadAvatar);

// POST /api/v1/employees/me/push-token - Register Expo push notification token
router.post("/me/push-token", validate(RegisterPushTokenSchema), employeeController.registerPushToken);

// GET /api/v1/employees - List employees (Admin/Manager directory)
router.get("/", employeeController.list);

// Mount attendance under /me/attendance for mobile client compatibility
router.use("/me/attendance", attendanceRouter);

export default router;
