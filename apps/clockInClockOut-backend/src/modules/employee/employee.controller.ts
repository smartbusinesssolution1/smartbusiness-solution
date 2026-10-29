import type { Request, Response } from "express";
import { EmployeeService } from "./employee.service.js";

export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  /**
   * GET /api/v1/employees/me
   * Resolves the authenticated user's complete employee profile, assigned workspaces, and baseline avatar status
   */
  getMe = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const role = req.tenant?.role;
    const headerWorkspaceId =
      (req.headers["x-workspace-id"] as string | undefined) ||
      (req.query.workspaceId as string | undefined);

    const profile = await this.employeeService.getEmployeeProfile(userId, tenantId, role, headerWorkspaceId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  };

  /**
   * PUT /api/v1/employees/me
   * PATCH /api/v1/employees/me
   * Update authenticated employee's personal contact info (fullName, phone, avatarUrl)
   */
  updateMe = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const role = req.tenant?.role;

    const result = await this.employeeService.updateEmployeeProfile(userId, tenantId, req.body, role);

    res.status(200).json({
      success: true,
      data: result,
      message: "Profile updated successfully.",
    });
  };

  /**
   * POST /api/v1/employees/me/avatar
   * Upload and register official baseline facial portrait (Image 2)
   */
  uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.employeeService.uploadBaselineAvatar(userId, tenantId, req.file);

    res.status(201).json({
      success: true,
      data: result,
      message: "Baseline biometric face profile registered successfully.",
    });
  };

  /**
   * POST /api/v1/employees/me/push-token
   * Register mobile device Expo push notification token
   */
  registerPushToken = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    await this.employeeService.registerPushToken(userId, tenantId, req.body);

    res.status(200).json({
      success: true,
      message: "Push notification token registered.",
    });
  };

  /**
   * GET /api/v1/employees
   * List all employees in current tenant workspace (Admin / Manager view)
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = (req.headers["x-workspace-id"] as string) || (req.query.workspaceId as string) || undefined;
    const employees = await this.employeeService.listEmployees(tenantId, workspaceId);

    res.status(200).json({
      success: true,
      data: employees,
    });
  };
}
