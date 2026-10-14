import type { Request, Response } from "express";
import { EmployeeService } from "./employee.service.js";

export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  /**
   * GET /api/v1/employees/me
   * Resolves the authenticated user's employee badge and profile
   */
  getMe = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const role = req.tenant?.role;

    const profile = await this.employeeService.getEmployeeProfile(userId, tenantId, role);

    res.status(200).json({
      success: true,
      data: profile,
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

