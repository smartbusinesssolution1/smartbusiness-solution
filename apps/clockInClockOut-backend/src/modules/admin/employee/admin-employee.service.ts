import crypto from "crypto";
import { prisma } from "@smartbusiness/database";
import { PasswordService } from "@smartbusiness/auth";
import { AdminEmployeeRepository } from "./admin-employee.repository.js";
import { NotFoundError, ValidationError, AppError, ForbiddenError } from "../../../shared/errors/index.js";
import { emailService } from "../../../shared/services/email.service.js";
import { memoryCache } from "../../../shared/services/cache.service.js";
import { storageService } from "../../../shared/services/storage.service.js";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeListQueryInput,
  DayShiftConfig,
} from "./admin-employee.schema.js";


/**
 * Builds standard 7-day schedule array (Mon-Fri work, Sat-Sun off)
 */
export const buildGeneralWeeklySchedule = (startTime = "09:00", endTime = "18:00"): DayShiftConfig[] => [
  { day: "MON", isWorkDay: true, startTime, endTime },
  { day: "TUE", isWorkDay: true, startTime, endTime },
  { day: "WED", isWorkDay: true, startTime, endTime },
  { day: "THU", isWorkDay: true, startTime, endTime },
  { day: "FRI", isWorkDay: true, startTime, endTime },
  { day: "SAT", isWorkDay: false, startTime, endTime },
  { day: "SUN", isWorkDay: false, startTime, endTime },
];

export class AdminEmployeeService {
  private passwordService = new PasswordService();

  constructor(private employeeRepo: AdminEmployeeRepository) { }

  /**
   * Helper to format an employee model instance into the client-facing DTO
   */
  private formatEmployeeDto(emp: any) {
    const user = emp.workspaceMember?.user;
    const workspace = emp.workspaceMember?.workspace;

    // Normalize weeklySchedule into 7-day array
    let formattedSchedule: DayShiftConfig[];
    if (Array.isArray(emp.weeklySchedule) && emp.weeklySchedule.length > 0) {
      formattedSchedule = emp.weeklySchedule;
    } else if (emp.weeklySchedule && typeof emp.weeklySchedule === "object") {
      // Support legacy map format { MON: { ... } }
      const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
      formattedSchedule = days.map((d) => ({
        day: d,
        isWorkDay: emp.weeklySchedule[d]?.isWorkDay ?? !["SAT", "SUN"].includes(d),
        startTime: emp.weeklySchedule[d]?.startTime || "09:00",
        endTime: emp.weeklySchedule[d]?.endTime || "18:00",
      }));
    } else {
      formattedSchedule = buildGeneralWeeklySchedule();
    }

    const mondayShift = formattedSchedule.find((s) => s.day === "MON");

    return {
      id: emp.id,
      userId: user?.id || emp.userId || "",
      employeeId: emp.employeeCode,
      name: user?.fullName || emp.fullName || "",
      email: user?.email || emp.email || "",
      phone: emp.phone || "",
      role: (emp.role === "admin" ? "admin" : "employee") as "admin" | "employee",
      status: (emp.isActive ? "active" : "inactive") as "active" | "inactive",
      designation: emp.designation || "",
      department: emp.department || "",
      joinedDate: emp.createdAt ? new Date(emp.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      avatarUrl: emp.biometricPhotoUrl || "",
      shiftType: (emp.shiftType === "custom" ? "custom" : "general") as "general" | "custom",
      shiftStartTime: mondayShift?.startTime || "09:00",
      shiftEndTime: mondayShift?.endTime || "18:00",
      weeklySchedule: formattedSchedule,
      workspaceId: workspace?.id || emp.workspaceId,
      workspaceName: workspace?.businessName || emp.workspaceName,
    };
  }

  /**
   * List employees with filtering and pagination (Ultra-fast cached with memoryCache)
   */
  async listEmployees(tenantId: string, query: EmployeeListQueryInput, callerUserId?: string) {
    const cacheKey = `admin:employees:${tenantId}:${JSON.stringify(query)}:${callerUserId || ""}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const { items, total, page, limit, totalPages } = await this.employeeRepo.listEmployees(tenantId, query, callerUserId);
    const result = {
      items: items.map((emp) => this.formatEmployeeDto(emp)),
      total,
      page,
      limit,
      totalPages,
    };

    memoryCache.set(cacheKey, result, 60); // 60s TTL
    return result;
  }

  /**
   * Get single employee by ID
   */
  /**
   * Check if an email is already associated with an existing user in this tenant,
   * distinguishing between current workspace (conflict) vs. other workspaces in tenant (warning).
   */
  async checkEmailAvailability(tenantId: string, email: string, currentWorkspaceId?: string) {
    const user = await this.employeeRepo.findUserWithTenantWorkspaces(email, tenantId);

    // If user does not exist or does not belong to this tenant, email is free/available
    if (!user || !user.tenantMembers || user.tenantMembers.length === 0) {
      return {
        exists: false,
      };
    }

    // Workspace memberships in this tenant
    const workspaceMemberships = user.workspaceMembers || [];
    const isInCurrentWorkspace = currentWorkspaceId
      ? workspaceMemberships.some((wm) => wm.workspace.id === currentWorkspaceId)
      : false;

    // Collate existing workspace summaries
    const existingWorkspaces = workspaceMemberships.map((wm) => {
      const activeProfile = wm.employeeProfiles?.[0];
      return {
        workspaceId: wm.workspace.id,
        workspaceName: wm.workspace.businessName,
        employeeCode: activeProfile?.employeeCode || null,
        designation: activeProfile?.designation || null,
        department: activeProfile?.department || null,
        role: activeProfile?.role || "employee",
        phone: activeProfile?.phone || null,
        avatarUrl: activeProfile?.biometricPhotoUrl || null,
        isActive: activeProfile?.isActive ?? true,
      };
    });

    const primaryProfile = existingWorkspaces.find((w) => w.isActive) || existingWorkspaces[0];

    if (isInCurrentWorkspace) {
      return {
        exists: true,
        status: "EXISTS_CURRENT_WORKSPACE" as const,
        message: "An employee with this email already exists in this workspace.",
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          phone: primaryProfile?.phone || null,
          avatarUrl: primaryProfile?.avatarUrl || null,
        },
        existingWorkspaces,
      };
    }

    return {
      exists: true,
      status: "EXISTS_OTHER_WORKSPACE" as const,
      message: "This user is already registered in another workspace within your organization.",
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: primaryProfile?.phone || null,
        avatarUrl: primaryProfile?.avatarUrl || null,
      },
      existingWorkspaces,
    };
  }

  async getEmployeeById(employeeId: string, tenantId: string) {
    const emp = await this.employeeRepo.findEmployeeById(employeeId, tenantId);
    if (!emp) {
      throw new NotFoundError("Employee");
    }
    return this.formatEmployeeDto(emp);
  }

  /**
   * Determine employee code (custom, workspace-prefixed e.g. EMP-GA004, or sequential EMP-xxx)
   */
  private async determineEmployeeCode(tenantId: string, workspaceId: string, customCode?: string): Promise<string> {
    if (customCode && customCode.trim()) {
      const trimmed = customCode.trim();
      const duplicate = await this.employeeRepo.findEmployeeByCode(trimmed, tenantId);
      if (duplicate) {
        throw new ValidationError(`Employee ID "${trimmed}" is already assigned to another active employee.`);
      }
      return trimmed;
    }

    // 1. Fetch existing active codes in this workspace
    let existingCodes = await this.employeeRepo.getExistingEmployeeCodes(tenantId, workspaceId);
    if (!existingCodes || existingCodes.length === 0) {
      existingCodes = await this.employeeRepo.getExistingEmployeeCodes(tenantId);
    }

    // 2. Detect prefix and max sequence number from existing codes (e.g. EMP-GA001 -> prefix EMP-GA, max 1)
    let detectedPrefix = "EMP-";
    let padLength = 3;
    let maxNum = 0;

    for (const code of existingCodes) {
      const match = code.match(/^([A-Za-z\-_]+?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const num = parseInt(numStr, 10);
        detectedPrefix = prefix;
        padLength = Math.max(padLength, numStr.length);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    // 3. Fallback: if no existing code was found, derive prefix from workspace name
    if (maxNum === 0 && existingCodes.length === 0) {
      const ws = await this.employeeRepo.findWorkspace(workspaceId, tenantId);
      if (ws?.businessName) {
        const words = ws.businessName.split(/\s+/).filter(Boolean);
        const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        detectedPrefix = initials ? `EMP-${initials}` : "EMP-";
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `${detectedPrefix}${String(nextNum).padStart(padLength, "0")}`;

    // Guarantee global uniqueness across the tenant
    const allTenantCodes = await this.employeeRepo.getExistingEmployeeCodes(tenantId);
    while (allTenantCodes.some((c) => c.toUpperCase() === candidate.toUpperCase())) {
      nextNum++;
      candidate = `${detectedPrefix}${String(nextNum).padStart(padLength, "0")}`;
    }

    return candidate;
  }

  /**
   * Provision a new employee with face biometric avatar and day-wise schedule
   */
  async createEmployee(
    tenantId: string,
    input: CreateEmployeeInput,
    avatarFile?: Express.Multer.File,
    callerRole?: string,
    workspaceId?: string,
  ) {
    const isOwner = (callerRole || "").toUpperCase() === "OWNER";
    if (input.role === "admin" && !isOwner) {
      throw new ForbiddenError("Admins have access to create Standard Employees only. Only organization owners can create administrators.");
    }
    // 1. Resolve workspace
    if (!workspaceId) {
      const defaultWorkspace = await this.employeeRepo.getFirstWorkspace(tenantId);
      if (!defaultWorkspace) {
        throw new AppError("No campus/workspace found for this organization.", 400, "NO_WORKSPACE");
      }
      workspaceId = defaultWorkspace.id;
    } else {
      const ws = await this.employeeRepo.findWorkspace(workspaceId, tenantId);
      if (!ws) {
        throw new NotFoundError("Workspace");
      }
    }

    // 2. Validate Avatar
    let biometricPhotoUrl: string;
    if (avatarFile) {
      const uploadResult = await storageService.uploadAvatar({
        tenantId,
        file: avatarFile,
      });
      biometricPhotoUrl = uploadResult.url;
    } else if (input.existingAvatarUrl) {
      biometricPhotoUrl = input.existingAvatarUrl;
    } else {
      throw new ValidationError("Corporate portrait photograph is mandatory for biometric face registration.");
    }

    // 3. Determine employee code (user-provided or smart sequential e.g. EMP-GA004...)
    const employeeCode = await this.determineEmployeeCode(tenantId, workspaceId, input.employeeId);

    // 4. Generate secure readable temporary password and hash it with PasswordService (Argon2id)
    const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const temporaryPassword = `GA${randomSuffix}!2026`;
    const passwordHash = await this.passwordService.hash(temporaryPassword);

    // 5. Ensure weeklySchedule is populated as 7-day array
    if (input.shiftType === "general" || !input.weeklySchedule) {
      const orgSettings = await prisma.attendanceSettings.findUnique({
        where: { workspaceId },
      });
      const defaultStart = orgSettings?.defaultShiftStartTime || "09:00";
      const defaultEnd = orgSettings?.defaultShiftEndTime || "18:00";
      input.weeklySchedule = buildGeneralWeeklySchedule(defaultStart, defaultEnd);
    }

    // 6. Execute atomic creation transaction
    const newEmployee = await this.employeeRepo.createEmployeeTransaction({
      tenantId,
      workspaceId,
      input,
      employeeCode,
      biometricPhotoUrl,
      passwordHash,
    });

    // 7. Dispatch welcome onboarding email with login credentials
    try {
      const [tenant, ws] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessName: true },
        }),
      ]);

      await emailService.sendEmployeeWelcomeEmail({
        to: input.email,
        employeeName: input.name,
        employeeCode,
        role: input.role,
        temporaryPassword,
        organizationName: tenant?.name,
        workspaceName: ws?.businessName,
      });
    } catch (emailErr) {
      // Non-blocking: Log warning if email fails, employee creation still succeeds
      console.error("[AdminEmployeeService] Failed to dispatch welcome email:", emailErr);
    }

    // Invalidate cached attendance analytics for tenant
    memoryCache.invalidatePattern(`active_employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:dataset:${tenantId}`);
    memoryCache.invalidatePattern(`admin:summary:${tenantId}`);
    memoryCache.invalidatePattern(`admin:report:${tenantId}`);
    memoryCache.invalidatePattern(`emp:by-user:${tenantId}`);

    return this.formatEmployeeDto(newEmployee);
  }

  /**
   * Update employee profile, role, status, or shift schedule
   */
  async updateEmployee(
    employeeId: string,
    tenantId: string,
    input: UpdateEmployeeInput,
    avatarFile?: Express.Multer.File,
    callerRole?: string
  ) {
    const existing = await this.employeeRepo.findEmployeeById(employeeId, tenantId);
    if (!existing) {
      throw new NotFoundError("Employee");
    }

    const isOwner = (callerRole || "").toUpperCase() === "OWNER";

    // Only OWNER can assign/promote someone to admin
    if (input.role === "admin" && !isOwner) {
      throw new ForbiddenError("Admins have access to manage Standard Employees only. Only organization owners can assign administrator privileges.");
    }

    // Only OWNER can modify an existing admin's profile or change their role
    if (existing.role === "admin" && !isOwner) {
      throw new ForbiddenError("Admins have access to manage Standard Employees only. Only organization owners can modify administrator profiles.");
    }

    // Validate unique employeeId if updated
    if (input.employeeId && input.employeeId !== existing.employeeCode) {
      const duplicate = await this.employeeRepo.findEmployeeByCode(input.employeeId, tenantId);
      if (duplicate && duplicate.id !== employeeId) {
        throw new ValidationError(`Employee ID "${input.employeeId}" is already assigned to another active employee.`);
      }
    }

    let newAvatarUrl: string | undefined;
    if (avatarFile) {
      const uploadRes = await storageService.uploadAvatar({ tenantId, file: avatarFile });
      newAvatarUrl = uploadRes.url;
      // Clean up previous avatar if it exists
      if (existing.biometricPhotoUrl) {
        await storageService.deleteAvatar(existing.biometricPhotoUrl);
      }
    }

    // If shiftType is set to general and no custom schedule is provided, populate organization general schedule
    if (input.shiftType === "general" && !input.weeklySchedule) {
      const orgSettings = await prisma.attendanceSettings.findUnique({
        where: { workspaceId: existing.workspaceMember.workspaceId },
      });
      const defaultStart = orgSettings?.defaultShiftStartTime || "09:00";
      const defaultEnd = orgSettings?.defaultShiftEndTime || "18:00";
      input.weeklySchedule = buildGeneralWeeklySchedule(defaultStart, defaultEnd);
    }

    const updated = await this.employeeRepo.updateEmployeeTransaction({
      employeeId,
      tenantId,
      input,
      newAvatarUrl,
    });

    if (!updated) {
      throw new NotFoundError("Employee");
    }

    // Invalidate cached attendance analytics for tenant
    memoryCache.invalidatePattern(`active_employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:dataset:${tenantId}`);
    memoryCache.invalidatePattern(`admin:summary:${tenantId}`);
    memoryCache.invalidatePattern(`admin:report:${tenantId}`);
    memoryCache.invalidatePattern(`emp:by-user:${tenantId}`);

    return this.formatEmployeeDto(updated);
  }

  /**
   * Delete employee
   */
  async deleteEmployee(employeeId: string, tenantId: string, callerRole?: string) {
    const existing = await this.employeeRepo.findEmployeeById(employeeId, tenantId);
    if (!existing) {
      throw new NotFoundError("Employee");
    }

    const isOwner = (callerRole || "").toUpperCase() === "OWNER";
    if (existing.role === "admin" && !isOwner) {
      throw new ForbiddenError("Only organization owners can delete administrator profiles.");
    }

    await this.employeeRepo.deleteEmployee(employeeId, tenantId);

    // Clean up avatar image
    if (existing.biometricPhotoUrl) {
      await storageService.deleteAvatar(existing.biometricPhotoUrl);
    }

    // Invalidate cached attendance analytics for tenant
    memoryCache.invalidatePattern(`active_employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:employees:${tenantId}`);
    memoryCache.invalidatePattern(`admin:dataset:${tenantId}`);
    memoryCache.invalidatePattern(`admin:summary:${tenantId}`);
    memoryCache.invalidatePattern(`admin:report:${tenantId}`);
    memoryCache.invalidatePattern(`emp:by-user:${tenantId}`);

    return { success: true, message: "Employee profile removed successfully." };
  }
}
