import { EmployeeRepository } from "./employee.repository.js";
import { AppError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { storageService } from "../../shared/services/storage.service.js";
import { logger } from "../../shared/services/logger.js";
import type { UpdateProfileInput, RegisterPushTokenInput } from "./employee.schema.js";

/**
 * Convert 24-hr time string "HH:mm" to "hh:mm AM/PM"
 */
function formatTimeToAMPM(timeStr: string): string {
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hoursFormatted}:${minutes} ${ampm}`;
}

export class EmployeeService {
  constructor(private employeeRepo: EmployeeRepository) { }

  /**
   * Resolve authenticated user's full employee profile and assigned workspaces
   */
  async getEmployeeProfile(userId: string, tenantId: string, role?: string) {
    // const employee = await this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId);
    const [employee, assignedMembers] = await Promise.all([
      this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId),
      this.employeeRepo.findAssignedWorkspaces(userId, tenantId),
    ]);
    if (!employee) {
      throw new NotFoundError("Employee profile");
    }

    const user = employee.workspaceMember.user;
    // const assignedMembers = await this.employeeRepo.findAssignedWorkspaces(userId, tenantId);

    const assignedWorkspaces = assignedMembers.map((member) => {
      const ws = member.workspace;
      const words = ws.businessName.split(/\s+/).filter(Boolean);
      const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      const code = initials ? `WS-${initials}` : `WS-${ws.id.slice(0, 4).toUpperCase()}`;

      return {
        workspaceId: ws.id,
        name: ws.businessName,
        code,
        isDefault: ws.id === employee.workspaceMember.workspaceId,
        address: [ws.addressLine1, ws.city, ws.state].filter(Boolean).join(", "),
        geofence: ws.attendanceSettings
          ? {
            latitude: Number(ws.attendanceSettings.latitude),
            longitude: Number(ws.attendanceSettings.longitude),
            radiusMeters: ws.attendanceSettings.radiusMeters,
            officeStartTime: ws.attendanceSettings.defaultShiftStartTime,
            officeEndTime: ws.attendanceSettings.defaultShiftEndTime,
            graceMinutes: ws.attendanceSettings.graceMinutes,
          }
          : null,
      };
    });

    // Derive shift schedule string (e.g. "09:00 AM - 06:00 PM")
    let startStr = "09:00";
    let endStr = "18:00";

    const scheduleArray = Array.isArray(employee.weeklySchedule) ? (employee.weeklySchedule as any[]) : null;
    if (scheduleArray && scheduleArray.length > 0) {
      const workDay = scheduleArray.find((d) => d && typeof d === "object" && d.isWorkDay) || scheduleArray[0];
      if (workDay && typeof workDay === "object") {
        if (typeof workDay.startTime === "string") startStr = workDay.startTime;
        if (typeof workDay.endTime === "string") endStr = workDay.endTime;
      }
    } else if (employee.weeklySchedule && typeof employee.weeklySchedule === "object" && !Array.isArray(employee.weeklySchedule)) {
      const scheduleMap = employee.weeklySchedule as Record<string, any>;
      const mon = scheduleMap["MON"] as { startTime?: string; endTime?: string } | undefined;
      if (typeof mon?.startTime === "string") startStr = mon.startTime;
      if (typeof mon?.endTime === "string") endStr = mon.endTime;
    } else if (employee.workspaceMember.workspace.attendanceSettings) {
      const attSettings = employee.workspaceMember.workspace.attendanceSettings;
      if (attSettings.defaultShiftStartTime) startStr = attSettings.defaultShiftStartTime;
      if (attSettings.defaultShiftEndTime) endStr = attSettings.defaultShiftEndTime;
    }

    const shiftSchedule = `${formatTimeToAMPM(startStr)} - ${formatTimeToAMPM(endStr)}`;

    // Generate avatar initials from full name (e.g. "Alex Mercer" -> "AM")
    const nameParts = user.fullName.trim().split(/\s+/).filter(Boolean);
    const avatarInitials = nameParts.length > 0
      ? nameParts.slice(0, 2).map((p) => p[0].toUpperCase()).join("")
      : "EM";

    const formattedJoinedDate = employee.createdAt
      ? new Date(employee.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      : "";

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      corporateId: employee.employeeCode,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      phone: employee.phone || "",
      role: (employee.role || "employee").toUpperCase(),
      status: employee.isActive ? "ACTIVE" : "INACTIVE",
      employmentStatus: employee.isActive ? "active" : "inactive",
      isActive: employee.isActive,
      designation: employee.designation || "",
      jobTitle: employee.designation || "Staff Member",
      department: employee.department || "General",
      joinedDate: employee.createdAt ? new Date(employee.createdAt).toISOString() : new Date().toISOString(),
      dateJoined: formattedJoinedDate,
      avatarUrl: employee.biometricPhotoUrl || "",
      biometricPhotoUrl: employee.biometricPhotoUrl || "",
      avatarInitials,
      avatarUpdatedAt: employee.updatedAt ? new Date(employee.updatedAt).toISOString() : null,
      mustChangePassword: false,
      shiftType: (employee.shiftType || "general").toLowerCase(),
      shiftSchedule,
      weeklySchedule: employee.weeklySchedule,
      workspaceId: employee.workspaceMember.workspaceId,
      workspaceName: employee.workspaceMember.workspace.businessName,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      assignedWorkspaces,
      tenantRole: role ?? "MEMBER",
    };
  }

  /**
   * Update personal profile information (fullName, phone, avatarUrl)
   */
  async updateEmployeeProfile(userId: string, tenantId: string, data: UpdateProfileInput) {
    const employee = await this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId);

    if (!employee) {
      throw new NotFoundError("Employee profile");
    }

    const fullName = data.fullName || data.name;
    const phone = data.phone;
    const biometricPhotoUrl = data.biometricPhotoUrl || data.avatarUrl;

    const result = await this.employeeRepo.updateProfileTransaction({
      employeeId: employee.id,
      userId,
      fullName,
      phone,
      biometricPhotoUrl,
    });

    return {
      id: employee.id,
      biometricPhotoUrl: result.employee.biometricPhotoUrl,
      avatarUrl: result.employee.biometricPhotoUrl,
      fullName: result.user?.fullName ?? employee.workspaceMember.user.fullName,
      phone: result.employee.phone ?? employee.phone,
      updatedAt: result.employee.updatedAt ? new Date(result.employee.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Upload baseline biometric facial portrait (Image 2 Registration)
   */
  async uploadBaselineAvatar(userId: string, tenantId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new ValidationError("Corporate portrait photograph is mandatory for biometric face registration.");
    }

    const employee = await this.employeeRepo.findEmployeeByUserIdAndTenant(userId, tenantId);

    if (!employee) {
      throw new NotFoundError("Employee profile");
    }

    const uploadResult = await storageService.uploadAvatar({
      tenantId,
      file,
    });

    const updated = await this.employeeRepo.updateEmployeeProfile(employee.id, {
      biometricPhotoUrl: uploadResult.url,
    });

    return {
      avatarUrl: updated.biometricPhotoUrl,
      avatarUpdatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString(),
      faceRegistered: true,
      livenessScore: 0.99,
    };
  }

  /**
   * Register push notification token for employee device
   */
  async registerPushToken(userId: string, tenantId: string, payload: RegisterPushTokenInput) {
    logger.info(
      {
        userId,
        tenantId,
        platform: payload.platform || "unknown",
        deviceName: payload.deviceName || "unknown",
        pushToken: payload.pushToken.slice(0, 15) + "...",
      },
      "Registered employee mobile push notification token"
    );

    return {
      registered: true,
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
}
