import fs from "fs";
import type { Request, Response } from "express";
import { AdminEmployeeService } from "./admin-employee.service.js";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  EmployeeIdParamSchema,
  EmployeeListQuerySchema,
} from "./admin-employee.schema.js";
import { ValidationError } from "../../../shared/errors/index.js";

export class AdminEmployeeController {
  constructor(private employeeService: AdminEmployeeService) {}

  /**
   * Safe helper to clean up uploaded file on failure
   */
  private cleanupFile(file?: Express.Multer.File) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Ignore unlink error
      }
    }
  }

  /**
   * GET /api/v1/admin/employees
   * List employees with filtering and pagination
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    const rawQuery = {
      ...req.query,
      workspaceId:
        req.query.workspaceId ||
        (headerWorkspaceId && headerWorkspaceId !== "null" && headerWorkspaceId !== "undefined"
          ? headerWorkspaceId
          : undefined),
    };
    const queryParsed = EmployeeListQuerySchema.safeParse(rawQuery);
    if (!queryParsed.success) {
      throw new ValidationError("Invalid query parameters", {
        query: queryParsed.error.issues.map((i) => i.message),
      });
    }

    const tenantId = req.tenant!.tenantId;
    const callerUserId = req.user?.userId;
    const result = await this.employeeService.listEmployees(tenantId, queryParsed.data, callerUserId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/admin/employees/:id
   * Retrieve single employee profile details
   */
  get = async (req: Request, res: Response): Promise<void> => {
    const paramParsed = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError("Invalid employee ID", {
        id: paramParsed.error.issues.map((i) => i.message),
      });
    }

    const tenantId = req.tenant!.tenantId;
    const result = await this.employeeService.getEmployeeById(paramParsed.data.id, tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * POST /api/v1/admin/employees
   * Provision new employee with avatar image and day-wise schedule
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const bodyParsed = CreateEmployeeSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      this.cleanupFile(req.file);
      const fieldErrors: Record<string, string[]> = {};
      bodyParsed.error.issues.forEach((issue) => {
        const field = issue.path.join(".") || "body";
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      });
      throw new ValidationError("Invalid employee registration data", fieldErrors);
    }

    if (!req.file) {
      throw new ValidationError("Corporate profile picture is mandatory for biometric face registration.");
    }

    const tenantId = req.tenant!.tenantId;
    const callerRole = req.tenant?.role;

    try {
      const result = await this.employeeService.createEmployee(
        tenantId,
        bodyParsed.data,
        req.file,
        callerRole
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      this.cleanupFile(req.file);
      throw err;
    }
  };

  /**
   * PUT /api/v1/admin/employees/:id
   * Update employee profile, status, role, or day-wise schedule
   */
  update = async (req: Request, res: Response): Promise<void> => {
    const paramParsed = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      this.cleanupFile(req.file);
      throw new ValidationError("Invalid employee ID", {
        id: paramParsed.error.issues.map((i) => i.message),
      });
    }

    const bodyParsed = UpdateEmployeeSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      this.cleanupFile(req.file);
      const fieldErrors: Record<string, string[]> = {};
      bodyParsed.error.issues.forEach((issue) => {
        const field = issue.path.join(".") || "body";
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      });
      throw new ValidationError("Invalid employee update data", fieldErrors);
    }

    const tenantId = req.tenant!.tenantId;
    const callerRole = req.tenant?.role;

    try {
      const result = await this.employeeService.updateEmployee(
        paramParsed.data.id,
        tenantId,
        bodyParsed.data,
        req.file,
        callerRole
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      this.cleanupFile(req.file);
      throw err;
    }
  };

  /**
   * DELETE /api/v1/admin/employees/:id
   * Delete or deactivate employee profile
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    const paramParsed = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError("Invalid employee ID", {
        id: paramParsed.error.issues.map((i) => i.message),
      });
    }

    const tenantId = req.tenant!.tenantId;
    const callerRole = req.tenant?.role;
    const result = await this.employeeService.deleteEmployee(paramParsed.data.id, tenantId, callerRole);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
