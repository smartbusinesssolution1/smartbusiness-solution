import { EmployeeRepository } from "./employee.repository.js";
import { AppError } from "../../shared/errors/index.js";

export class EmployeeService {
  constructor(private employeeRepo: EmployeeRepository) {}

  /**
   * Resolve authenticated user's employee profile
   */
  async getEmployeeProfile(userId: string, tenantId: string, role?: string) {
    const employee = await this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId);

    if (!employee) {
      throw new AppError("Employee attendance profile not found for this workspace.", 404);
    }

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      department: employee.department,
      biometricPhotoUrl: employee.biometricPhotoUrl,
      isActive: employee.isActive,
      workspaceId: employee.workspaceMember.workspaceId,
      workspaceName: employee.workspaceMember.workspace.businessName,
      user: {
        id: employee.workspaceMember.user.id,
        fullName: employee.workspaceMember.user.fullName,
        email: employee.workspaceMember.user.email,
      },
      tenantRole: role ?? "MEMBER",
    };
  }

  /**
   * List all employees in tenant (for Admin/Manager directory, optionally filtered by workspaceId)
   */
  async listEmployees(tenantId: string, workspaceId?: string) {
    const employees = await this.employeeRepo.findEmployeesByTenant(tenantId, workspaceId);
    return employees.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      name: emp.workspaceMember.user.fullName,
      email: emp.workspaceMember.user.email,
      designation: emp.designation,
      department: emp.department,
      biometricPhotoUrl: emp.biometricPhotoUrl,
      isActive: emp.isActive,
      workspaceId: emp.workspaceMember.workspaceId,
      workspaceName: emp.workspaceMember.workspace.businessName,
    }));
  }

  /**
   * Update employee profile (biometricPhotoUrl)
   */
  async updateEmployeeProfile(userId: string, tenantId: string, data: { biometricPhotoUrl?: string }) {
    const employee = await this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId);

    if (!employee) {
      throw new AppError("Employee attendance profile not found for this workspace.", 404);
    }

    const updated = await this.employeeRepo.updateEmployeeProfile(employee.id, data);
    return {
      id: updated.id,
      biometricPhotoUrl: updated.biometricPhotoUrl,
    };
  }
}

