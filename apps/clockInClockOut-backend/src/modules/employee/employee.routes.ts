import { Router } from "express";
import { EmployeeRepository } from "./employee.repository.js";
import { EmployeeService } from "./employee.service.js";
import { EmployeeController } from "./employee.controller.js";

// Composition Root
const employeeRepo = new EmployeeRepository();
const employeeService = new EmployeeService(employeeRepo);
const employeeController = new EmployeeController(employeeService);

const router: Router = Router();

// Routes
router.get("/me", employeeController.getMe);
router.get("/", employeeController.list);

export default router;
