import { RegularizationRepository } from "./regularization.repository.js";
import type {
  SubmitRegularizationInput,
  ListRegularizationsQueryInput,
} from "./regularization.schema.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../../shared/errors/index.js";

export class RegularizationService {
  constructor(private repo: RegularizationRepository) {}

  async submitRequest(
    tenantId: string,
    workspaceId: string,
    callerUserId: string,
    callerRole: string,
    data: SubmitRegularizationInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    // 1. Resolve employee
    let employeeId: string;
    const isCallerAdmin = callerRole === "ADMIN" || callerRole === "OWNER";

    if (data.employeeId) {
      if (!isCallerAdmin) {
        const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
        if (!callerEmp || callerEmp.id !== data.employeeId) {
          throw new ForbiddenError("You can only submit regularization requests for yourself.");
        }
      }
      employeeId = data.employeeId;
    } else {
      const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
      if (!callerEmp) {
        throw new ValidationError("No employee record associated with your user in this workspace.");
      }
      employeeId = callerEmp.id;
    }

    // 2. Fetch and enforce attendance settings
    const settings = await this.repo.getAttendanceSettings(workspaceId);
    if (settings && settings.enableRegularization === false) {
      throw new ValidationError("Attendance regularization is currently disabled for this organization.");
    }

    // 3. Date horizon validation
    // Parse target date as UTC midnight
    const targetDate = new Date(`${data.date}T00:00:00.000Z`);
    const today = new Date();
    const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (targetDate.getTime() > todayMidnight.getTime()) {
      throw new ValidationError("Cannot regularize attendance for future dates.");
    }

    const maxPastDays = settings?.maxRegularizationPastDays ?? 30;
    const diffDays = Math.floor((todayMidnight.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > maxPastDays) {
      throw new ValidationError(`Regularization is only permitted for dates within the past ${maxPastDays} days.`);
    }

    // 4. Monthly quota validation
    const monthlyLimit = settings?.monthlyRegularizationLimit ?? 5;
    if (monthlyLimit > 0) {
      const currentYear = targetDate.getUTCFullYear();
      const currentMonth = targetDate.getUTCMonth() + 1;
      const countThisMonth = await this.repo.countMonthlyRequests(employeeId, currentYear, currentMonth);

      if (countThisMonth >= monthlyLimit) {
        throw new ValidationError(
          `Monthly regularization limit of ${monthlyLimit} request(s) has been reached for ${currentMonth}/${currentYear}.`
        );
      }
    }

    // 5. Approved leave conflict check
    const approvedLeave = await this.repo.findApprovedLeaveOnDate(employeeId, targetDate);
    if (approvedLeave) {
      throw new ValidationError(
        `Cannot regularize attendance: You were on approved ${approvedLeave.policy.name} (${approvedLeave.policy.category}) leave on this date.`
      );
    }

    // 6. Check for existing pending request on the same date
    const existingPending = await this.repo.findPendingRequestOnDate(employeeId, targetDate);
    if (existingPending) {
      throw new ValidationError("A pending regularization request already exists for this date.");
    }

    // 7. Find existing attendance record if any
    const existingRecord = await this.repo.findAttendanceRecordOnDate(employeeId, targetDate);

    // 8. Create regularization request
    return this.repo.createRegularization({
      workspaceId,
      employeeId,
      attendanceRecordId: existingRecord?.id || null,
      date: targetDate,
      reasonCategory: data.reasonCategory,
      reasonText: data.reasonText,
      requestedClockInTime: data.requestedClockInTime ? new Date(data.requestedClockInTime) : null,
      requestedClockOutTime: data.requestedClockOutTime ? new Date(data.requestedClockOutTime) : null,
    });
  }

  async listRequests(
    tenantId: string,
    workspaceId: string,
    callerUserId: string,
    callerRole: string,
    query: ListRegularizationsQueryInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const isCallerAdmin = callerRole === "ADMIN" || callerRole === "OWNER";
    let employeeIdFilter: string | undefined;

    if (!isCallerAdmin) {
      const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
      if (!callerEmp) {
        return { total: 0, page: 1, limit: query.limit || 20, totalPages: 0, items: [] };
      }
      employeeIdFilter = callerEmp.id;
    }

    return this.repo.listRegularizations(workspaceId, {
      ...query,
      employeeIdFilter,
    });
  }

  async getMyRequests(
    tenantId: string,
    workspaceId: string,
    callerUserId: string,
    query: ListRegularizationsQueryInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
    if (!callerEmp) {
      return { total: 0, page: 1, limit: query.limit || 20, totalPages: 0, items: [] };
    }

    return this.repo.listRegularizations(workspaceId, {
      ...query,
      employeeIdFilter: callerEmp.id,
    });
  }

  async getRequestById(tenantId: string, workspaceId: string, callerUserId: string, callerRole: string, id: string) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findById(id, workspaceId);
    if (!request) throw new NotFoundError("Regularization request not found");

    const isCallerAdmin = callerRole === "ADMIN" || callerRole === "OWNER";
    if (!isCallerAdmin) {
      const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
      if (!callerEmp || callerEmp.id !== request.employeeId) {
        throw new ForbiddenError("You are not authorized to view this request.");
      }
    }

    return request;
  }

  async approveRequest(
    tenantId: string,
    workspaceId: string,
    reviewerUserId: string,
    requestId: string,
    reviewerNotes?: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findById(requestId, workspaceId);
    if (!request) throw new NotFoundError("Regularization request not found");

    if (request.status !== "PENDING") {
      throw new ValidationError(`Cannot approve request with current status '${request.status}'`);
    }

    const settings = await this.repo.getAttendanceSettings(workspaceId);

    return this.repo.executeApprovalTransaction({
      requestId,
      workspaceId,
      reviewerId: reviewerUserId,
      reviewerNotes,
      employeeId: request.employeeId,
      date: request.date,
      requestedClockInTime: request.requestedClockInTime,
      requestedClockOutTime: request.requestedClockOutTime,
      settings: settings
        ? {
            latitude: settings.latitude,
            longitude: settings.longitude,
            defaultShiftStartTime: settings.defaultShiftStartTime,
            defaultShiftEndTime: settings.defaultShiftEndTime,
          }
        : null,
    });
  }

  async rejectRequest(
    tenantId: string,
    workspaceId: string,
    reviewerUserId: string,
    requestId: string,
    reviewerNotes?: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findById(requestId, workspaceId);
    if (!request) throw new NotFoundError("Regularization request not found");

    if (request.status !== "PENDING") {
      throw new ValidationError(`Cannot reject request with current status '${request.status}'`);
    }

    return this.repo.rejectRequest(requestId, reviewerUserId, reviewerNotes);
  }

  async cancelRequest(
    tenantId: string,
    workspaceId: string,
    callerUserId: string,
    callerRole: string,
    requestId: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findById(requestId, workspaceId);
    if (!request) throw new NotFoundError("Regularization request not found");

    const isCallerAdmin = callerRole === "ADMIN" || callerRole === "OWNER";
    if (!isCallerAdmin) {
      const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
      if (!callerEmp || callerEmp.id !== request.employeeId) {
        throw new ForbiddenError("You can only cancel your own regularization request.");
      }
    }

    if (request.status !== "PENDING") {
      throw new ValidationError(`Cannot cancel a request that is already '${request.status}'`);
    }

    return this.repo.cancelRequest(requestId);
  }
}
