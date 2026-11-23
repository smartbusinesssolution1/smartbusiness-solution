import { LeaveRepository } from "./leave.repository.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../../shared/errors/index.js";
import { logger } from "../../shared/services/logger.js";
import { pushNotificationService } from "../../shared/services/push-notification.service.js";
import {
  CreateLeavePolicySchema,
  type CreateLeavePolicyInput,
  type CreateLeavePolicyRawInput,
  type UpdateLeavePolicyInput,
  type SubmitLeaveRequestInput,
  type ReviewLeaveRequestInput,
  type ListLeaveRequestsQueryInput,
  type GetTeamCalendarQueryInput,
  type CheckConflictQueryInput,
  type CalculateTerminationPayoutInput,
  type PayrollExportQueryInput,
  type AssignLeaveBalanceInput,
} from "./leave.schema.js";

export class LeaveService {
  constructor(private repo: LeaveRepository) {}

  private serializePolicy(policy: any) {
    return {
      ...policy,
      rate: policy.rate ? Number(policy.rate) : 0,
      hoursPerYear: policy.hoursPerYear ? Number(policy.hoursPerYear) : 0,
      maxCarryoverHours: policy.maxCarryoverHours ? Number(policy.maxCarryoverHours) : 0,
      accrualCapHours: policy.accrualCapHours ? Number(policy.accrualCapHours) : null,
    };
  }

  private serializeBalance(balance: any) {
    const allocated = Number(balance.allocatedHours || 0);
    const accrued = Number(balance.accruedHours || 0);
    const carriedOver = Number(balance.carriedOverHours || 0);
    const used = Number(balance.usedHours || 0);
    const pending = Number(balance.pendingHours || 0);
    const available = Math.max(0, allocated + accrued + carriedOver - (used + pending));

    return {
      id: balance.id,
      employeeId: balance.employeeId,
      policyId: balance.policyId,
      year: balance.year,
      policy: balance.policy ? this.serializePolicy(balance.policy) : undefined,
      employee: balance.employee
        ? {
            id: balance.employee.id,
            employeeCode: balance.employee.employeeCode,
            designation: balance.employee.designation,
            department: balance.employee.department,
            createdAt: balance.employee.createdAt,
            workspaceMember: balance.employee.workspaceMember
              ? {
                  id: balance.employee.workspaceMember.id,
                  user: balance.employee.workspaceMember.user
                    ? {
                        id: balance.employee.workspaceMember.user.id,
                        fullName: balance.employee.workspaceMember.user.fullName,
                        email: balance.employee.workspaceMember.user.email,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      allocatedHours: allocated,
      accruedHours: accrued,
      carriedOverHours: carriedOver,
      usedHours: used,
      pendingHours: pending,
      availableHours: available,
      balanceHours: available,
    };
  }

  private serializeRequest(request: any) {
    return {
      ...request,
      totalHours: Number(request.totalHours || 0),
      policy: request.policy ? this.serializePolicy(request.policy) : undefined,
    };
  }

  // ─── Policy Management ─────────────────────────────────────────────────────

  async createPolicy(tenantId: string, workspaceId: string, data: CreateLeavePolicyInput) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const code = data.code.trim().toUpperCase();
    const existing = await this.repo.findPolicyByCode(workspaceId, code);
    if (existing) {
      throw new ValidationError(`Policy with code '${code}' already exists in this workspace.`);
    }

    const created = await this.repo.createPolicy(workspaceId, {
      ...data,
      code,
    });

    return this.serializePolicy(created);
  }

  async listPolicies(tenantId: string, workspaceId: string, isActive?: boolean) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const items = await this.repo.listPolicies(workspaceId, isActive);
    return items.map((p) => this.serializePolicy(p));
  }

  async getPolicyById(tenantId: string, workspaceId: string, id: string) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const policy = await this.repo.findPolicyById(id, workspaceId);
    if (!policy) throw new NotFoundError("Policy not found");

    return this.serializePolicy(policy);
  }

  async updatePolicy(tenantId: string, workspaceId: string, id: string, data: UpdateLeavePolicyInput) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const existing = await this.repo.findPolicyById(id, workspaceId);
    if (!existing) throw new NotFoundError("Policy not found");

    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const duplicate = await this.repo.findPolicyByCode(workspaceId, code, id);
      if (duplicate) {
        throw new ValidationError(`Policy with code '${code}' already exists in this workspace.`);
      }
      data.code = code;
    }

    const updated = await this.repo.updatePolicy(id, workspaceId, data);
    return this.serializePolicy(updated);
  }

  async deletePolicy(tenantId: string, workspaceId: string, id: string) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const existing = await this.repo.findPolicyById(id, workspaceId);
    if (!existing) throw new NotFoundError("Policy not found");

    await this.repo.softDeletePolicy(id, workspaceId);
    return { success: true };
  }

  async seedUsStatePresets(tenantId: string, workspaceId: string, presetType: string = "ALL") {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const presets: CreateLeavePolicyRawInput[] = [
      {
        name: "Standard Unified PTO",
        code: "STD-PTO",
        category: "PTO",
        accrualType: "PER_PAY_PERIOD",
        rate: 4.62, // 120h per 26 pay periods
        hoursPerYear: 120,
        maxCarryoverHours: 40,
        accrualCapHours: 160,
        waitingPeriodDays: 90,
        minNoticeDays: 7,
        isPaid: true,
        payoutOnTermination: true,
        requiresApproval: true,
        description: "Combined vacation, personal, and minor sickness PTO bank (15 days/yr).",
      },
      {
        name: "California Paid Sick Leave (CA PSL)",
        code: "CA-PSL",
        category: "SICK",
        accrualType: "HOURLY_ACCRUAL",
        rate: 0.0333, // 1h per 30h worked
        hoursPerYear: 40,
        maxCarryoverHours: 40,
        accrualCapHours: 80,
        waitingPeriodDays: 90,
        minNoticeDays: 0,
        isPaid: true,
        payoutOnTermination: false,
        requiresApproval: false,
        requiresDocDays: 3,
        description: "Mandated California Healthy Workplaces Healthy Families Act (min 40h/5d).",
      },
      {
        name: "New York Paid Sick Leave (NY PSL)",
        code: "NY-PSL",
        category: "SICK",
        accrualType: "HOURLY_ACCRUAL",
        rate: 0.0333, // 1h per 30h worked
        hoursPerYear: 40,
        maxCarryoverHours: 40,
        accrualCapHours: 40,
        waitingPeriodDays: 0,
        minNoticeDays: 0,
        isPaid: true,
        payoutOnTermination: false,
        requiresApproval: false,
        requiresDocDays: 3,
        description: "New York State statutory paid sick leave (1h per 30h worked).",
      },
      {
        name: "Illinois Paid Leave (PLAAR)",
        code: "IL-PLAAR",
        category: "PTO",
        accrualType: "HOURLY_ACCRUAL",
        rate: 0.025, // 1h per 40h worked
        hoursPerYear: 40,
        maxCarryoverHours: 40,
        accrualCapHours: 40,
        waitingPeriodDays: 90,
        minNoticeDays: 0,
        isPaid: true,
        payoutOnTermination: true,
        requiresApproval: true,
        description: "Illinois Paid Leave for Any Reason Act (40 hours per year).",
      },
      {
        name: "Annual Vacation",
        code: "VACATION",
        category: "VACATION",
        accrualType: "FRONTLOAD",
        rate: 0,
        hoursPerYear: 80,
        maxCarryoverHours: 40,
        accrualCapHours: 120,
        waitingPeriodDays: 90,
        minNoticeDays: 14,
        isPaid: true,
        payoutOnTermination: true,
        requiresApproval: true,
        description: "Dedicated annual paid vacation (10 days/yr) with planned advance notice.",
      },
      {
        name: "FMLA Job-Protected Medical Leave",
        code: "FMLA",
        category: "FMLA",
        accrualType: "FRONTLOAD",
        rate: 0,
        hoursPerYear: 480, // 12 weeks @ 40h
        maxCarryoverHours: 0,
        waitingPeriodDays: 365,
        minNoticeDays: 30,
        isPaid: false,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresDocDays: 1,
        description: "Federal Family and Medical Leave Act (12 weeks unpaid, job-protected).",
      },
      {
        name: "Bereavement Leave",
        code: "BEREAVEMENT",
        category: "BEREAVEMENT",
        accrualType: "FRONTLOAD",
        rate: 0,
        hoursPerYear: 24, // 3 days
        maxCarryoverHours: 0,
        waitingPeriodDays: 0,
        minNoticeDays: 0,
        isPaid: true,
        payoutOnTermination: false,
        requiresApproval: true,
        description: "Compassionate leave for immediate family bereavement (3 days paid).",
      },
    ];

    const results = [];
    for (const p of presets) {
      const existing = await this.repo.findPolicyByCode(workspaceId, p.code);
      if (!existing) {
        const parsed = CreateLeavePolicySchema.parse(p);
        const created = await this.repo.createPolicy(workspaceId, parsed);
        results.push(this.serializePolicy(created));
      }
    }

    return results;
  }

  // ─── Balances ──────────────────────────────────────────────────────────────

  async getEmployeeBalances(tenantId: string, workspaceId: string, employeeId: string, year: number) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const policies = await this.repo.listPolicies(workspaceId, true);
    for (const policy of policies) {
      const initialAlloc = policy.accrualType === "FRONTLOAD" ? Number(policy.hoursPerYear) : 0;
      await this.repo.getOrCreateBalance(employeeId, policy.id, year, initialAlloc);
    }

    const balances = await this.repo.listEmployeeBalances(employeeId, year);
    return balances.map((b) => this.serializeBalance(b));
  }

  // ─── Leave Requests Lifecycle ──────────────────────────────────────────────

  async submitRequest(
    tenantId: string,
    workspaceId: string,
    callerUserId: string,
    callerRole: string,
    data: SubmitLeaveRequestInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    // Resolve employee
    let employeeId: string;
    if (data.employeeId) {
      if (callerRole !== "ADMIN" && callerRole !== "OWNER") {
        const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
        if (!callerEmp || callerEmp.id !== data.employeeId) {
          throw new ForbiddenError("You can only submit leave requests for yourself.");
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

    // Validate dates
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end < start) {
      throw new ValidationError("End date cannot be earlier than start date.");
    }

    const policy = await this.repo.findPolicyById(data.policyId, workspaceId);
    if (!policy || !policy.isActive) {
      throw new NotFoundError("Selected leave policy is not active or not found.");
    }

    // Check notice period
    if (policy.minNoticeDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < policy.minNoticeDays && callerRole !== "ADMIN" && callerRole !== "OWNER") {
        throw new ValidationError(
          `This policy requires at least ${policy.minNoticeDays} days advance notice.`
        );
      }
    }

    // Check documentation threshold
    const requestDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (policy.requiresDocDays && requestDays >= policy.requiresDocDays && !data.attachmentUrl) {
      throw new ValidationError(
        `Leave requests of ${policy.requiresDocDays} days or more under this policy require documentation (doctor note / proof).`
      );
    }

    // Check available balance
    const year = start.getFullYear();
    const initialAlloc = policy.accrualType === "FRONTLOAD" ? Number(policy.hoursPerYear) : 0;
    const currentBalance = await this.repo.getOrCreateBalance(employeeId, policy.id, year, initialAlloc);
    const serializedBal = this.serializeBalance(currentBalance);

    if (policy.accrualType !== "UNLIMITED" && policy.category !== "UNPAID") {
      if (serializedBal.availableHours < data.totalHours) {
        throw new ValidationError(
          `Insufficient balance. You have ${serializedBal.availableHours} hours available, but requested ${data.totalHours} hours.`
        );
      }
    }

    const { request } = await this.repo.createRequestWithBalanceHold(
      workspaceId,
      employeeId,
      policy,
      data,
      year
    );

    return this.serializeRequest(request);
  }

  async listRequests(tenantId: string, workspaceId: string, query: ListLeaveRequestsQueryInput) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const requests = await this.repo.listRequests(workspaceId, query);
    return requests.map((r) => this.serializeRequest(r));
  }

  async getMyRequests(tenantId: string, workspaceId: string, userId: string, query: ListLeaveRequestsQueryInput) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const emp = await this.repo.findEmployeeByUserId(workspaceId, userId);
    if (!emp) return [];

    const requests = await this.repo.listRequests(workspaceId, {
      ...query,
      employeeId: emp.id,
    });

    return requests.map((r) => this.serializeRequest(r));
  }

  async reviewRequest(
    tenantId: string,
    workspaceId: string,
    requestId: string,
    reviewerUserId: string,
    review: ReviewLeaveRequestInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findRequestById(requestId, workspaceId);
    if (!request) throw new NotFoundError("Leave request not found");

    if (request.status === "REJECTED" || request.status === "CANCELLED") {
      throw new ValidationError(`Cannot review request that is already ${request.status}.`);
    }

    if (request.status === "APPROVED" && review.status === "APPROVED") {
      throw new ValidationError("Leave request is already approved.");
    }

    const updated = await this.repo.reviewRequest(request, review, reviewerUserId);

    // Asynchronously dispatch push notification to employee device
    try {
      const recipientUserId = updated.employee?.workspaceMember?.user?.id || request.employee?.workspaceMember?.user?.id;
      const recipientEmployeeId = updated.employeeId || request.employeeId;
      const isApproved = review.status === "APPROVED";
      const policyName = updated.policy?.name || request.policy?.name || "Leave";
      const title = isApproved ? "Leave Request Approved 🎉" : "Leave Request Rejected ❌";
      const statusText = isApproved ? "approved" : "rejected";
      const noteSuffix = review.reviewerNotes?.trim() ? `: "${review.reviewerNotes.trim()}"` : ".";
      const body = `Your request for ${policyName} (${updated.startDate} to ${updated.endDate}) was ${statusText}${noteSuffix}`;

      pushNotificationService
        .sendPushNotification({
          userId: recipientUserId,
          employeeId: recipientEmployeeId,
          title,
          body,
          data: {
            type: "LEAVE_STATUS_UPDATE",
            requestId: updated.id,
            status: updated.status,
            policyName,
            startDate: updated.startDate,
            endDate: updated.endDate,
          },
        })
        .catch((err) => {
          logger.warn({ err: err?.message, requestId: updated.id }, "Push notification delivery failed in background");
        });
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to initiate push notification for reviewed leave");
    }

    return this.serializeRequest(updated);
  }

  async cancelRequest(
    tenantId: string,
    workspaceId: string,
    requestId: string,
    callerUserId: string,
    callerRole: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const request = await this.repo.findRequestById(requestId, workspaceId);
    if (!request) throw new NotFoundError("Leave request not found");

    // Only owner of the request or admin can cancel
    if (callerRole !== "ADMIN" && callerRole !== "OWNER") {
      const callerEmp = await this.repo.findEmployeeByUserId(workspaceId, callerUserId);
      if (!callerEmp || callerEmp.id !== request.employeeId) {
        throw new ForbiddenError("You can only cancel your own leave requests.");
      }
    }

    if (request.status === "REJECTED" || request.status === "CANCELLED") {
      throw new ValidationError(`Request is already ${request.status}.`);
    }

    const cancelled = await this.repo.cancelRequest(request);

    // If cancelled by admin/manager (not the employee themselves), notify the employee
    try {
      const recipientUserId = request.employee?.workspaceMember?.user?.id;
      if (recipientUserId && callerUserId !== recipientUserId) {
        const policyName = request.policy?.name || "Leave";
        pushNotificationService
          .sendPushNotification({
            userId: recipientUserId,
            employeeId: request.employeeId,
            title: "Leave Request Cancelled ⚠️",
            body: `Your request for ${policyName} (${request.startDate} to ${request.endDate}) was cancelled by administration.`,
            data: {
              type: "LEAVE_STATUS_UPDATE",
              requestId: cancelled.id,
              status: "CANCELLED",
              policyName,
              startDate: cancelled.startDate,
              endDate: cancelled.endDate,
            },
          })
          .catch(() => {});
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to dispatch push notification for cancelled leave");
    }

    return this.serializeRequest(cancelled);
  }

  // ─── Automatic Accrual Engine ──────────────────────────────────────────────

  /**
   * Hook for Attendance Clock-Out: Automatically accrues sick leave / PTO for worked hours.
   * Runs for all active HOURLY_ACCRUAL policies in the employee's workspace.
   * e.g., California PSL accrues 1 hour per 30 hours worked (rate = 0.03333).
   * e.g., Illinois PLAAR accrues 1 hour per 40 hours worked (rate = 0.025).
   */
  async accrueHourlyLeavesForWorkedShift(
    employeeId: string,
    workspaceId: string,
    workedHours: number
  ) {
    if (!employeeId || !workspaceId || workedHours <= 0) return [];

    const activeHourlyPolicies = await this.repo.findActiveHourlyPolicies(workspaceId);
    if (!activeHourlyPolicies || activeHourlyPolicies.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const results = [];

    for (const policy of activeHourlyPolicies) {
      const rate = Number(policy.rate || 0);
      if (rate <= 0) continue;

      const rawEarned = workedHours * rate;
      const cap = policy.accrualCapHours ? Number(policy.accrualCapHours) : null;

      try {
        const creditResult = await this.repo.creditAccrualToBalance(
          employeeId,
          policy.id,
          currentYear,
          rawEarned,
          cap
        );

        logger.info(
          {
            employeeId,
            workspaceId,
            policyCode: policy.code,
            workedHours,
            creditedHours: creditResult.creditedHours,
            currentAccrued: creditResult.currentAccrued,
            capReached: creditResult.capReached,
          },
          "Accrued hourly leave for completed shift"
        );

        results.push({
          policyId: policy.id,
          policyCode: policy.code,
          ...creditResult,
        });
      } catch (err) {
        logger.error(
          { err, employeeId, policyId: policy.id, workedHours },
          "Failed to credit hourly accrual for employee"
        );
      }
    }

    return results;
  }

  /**
   * Run Pay-Period Accrual Cycle (e.g. bi-weekly or semi-monthly accrual)
   * Credits all active employees for active PER_PAY_PERIOD policies.
   */
  async runPayPeriodAccruals(tenantId: string, workspaceId: string, year?: number) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const targetYear = year || new Date().getFullYear();
    const policies = await this.repo.findActivePayPeriodPolicies(workspaceId);
    if (!policies || policies.length === 0) {
      return {
        success: true,
        message: "No active PER_PAY_PERIOD policies found in this workspace.",
        policiesProcessed: 0,
        employeesProcessed: 0,
        totalHoursAccrued: 0,
      };
    }

    const employees = await this.repo.listActiveWorkspaceEmployees(workspaceId);
    if (!employees || employees.length === 0) {
      return {
        success: true,
        message: "No active employees found in this workspace.",
        policiesProcessed: policies.length,
        employeesProcessed: 0,
        totalHoursAccrued: 0,
      };
    }

    let employeesProcessed = 0;
    let totalHoursAccrued = 0;

    for (const policy of policies) {
      // If rate is configured (e.g. 3.33 hrs/pay-period), use it; otherwise divide hoursPerYear by standard 24 periods
      const payPeriodHours =
        Number(policy.rate || 0) > 0
          ? Number(policy.rate)
          : Number(policy.hoursPerYear || 40) / 24;

      const cap = policy.accrualCapHours ? Number(policy.accrualCapHours) : null;

      for (const emp of employees) {
        try {
          const res = await this.repo.creditAccrualToBalance(
            emp.id,
            policy.id,
            targetYear,
            payPeriodHours,
            cap
          );
          totalHoursAccrued += res.creditedHours;
          employeesProcessed++;
        } catch (err) {
          logger.error(
            { err, employeeId: emp.id, policyId: policy.id },
            "Failed to credit pay-period accrual"
          );
        }
      }
    }

    return {
      success: true,
      message: `Successfully processed pay-period accruals for ${policies.length} policies across ${employees.length} employees.`,
      policiesProcessed: policies.length,
      employeesProcessed,
      totalHoursAccrued: Math.round(totalHoursAccrued * 100) / 100,
    };
  }

  /**
   * Run Year-End Rollover: Rollover unused leave hours into next calendar year up to maxCarryoverHours.
   */
  async runRollover(
    tenantId: string,
    workspaceId: string,
    fromYear: number,
    toYear: number
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    if (toYear <= fromYear) {
      throw new ValidationError("Target year (toYear) must be greater than source year (fromYear).");
    }

    const result = await this.repo.runYearEndRollover(workspaceId, fromYear, toYear);
    return {
      success: true,
      message: `Rolled over ${result.totalHoursRolledOver} hours for ${result.rolledOverCount} employee balances from ${fromYear} to ${toYear}.`,
      ...result,
    };
  }

  /**
   * List all workspace balances for admin reporting.
   */
  async listWorkspaceBalances(
    tenantId: string,
    workspaceId: string,
    year?: number,
    employeeId?: string,
    policyId?: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const balances = await this.repo.listWorkspaceBalances(workspaceId, year, employeeId, policyId);
    return balances.map((b) => this.serializeBalance(b));
  }

  /**
   * Assigns, initializes or adjusts an employee's leave balance.
   * Enables mid-year joiner proration, manual adjustments, and annual starting grants.
   */
  async assignOrAdjustBalance(
    tenantId: string,
    workspaceId: string,
    input: AssignLeaveBalanceInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const employee = await this.repo.findEmployeeById(workspaceId, input.employeeId);
    if (!employee) throw new NotFoundError("Employee profile not found in this workspace");

    const policy = await this.repo.findPolicyById(input.policyId, workspaceId);
    if (!policy) throw new NotFoundError("Leave policy not found in this workspace");

    const balance = await this.repo.assignOrAdjustBalance(
      input.employeeId,
      input.policyId,
      input.year,
      input.allocatedHours,
      input.carriedOverHours
    );

    logger.info(
      {
        workspaceId,
        employeeId: input.employeeId,
        policyId: input.policyId,
        year: input.year,
        allocatedHours: input.allocatedHours,
        hireDate: input.hireDate,
        notes: input.notes,
      },
      "Assigned / prorated leave balance for employee"
    );

    return this.serializeBalance(balance);
  }

  // ─── Team Calendar & Staffing Conflict Guard ──────────────────────────────

  /**
   * List distinct departments in the workspace.
   */
  async listDepartments(tenantId: string, workspaceId: string) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    return this.repo.listDepartments(workspaceId);
  }

  /**
   * Fetch team calendar events within given month or date range.
   */
  async getTeamCalendarLeaves(
    tenantId: string,
    workspaceId: string,
    query: GetTeamCalendarQueryInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    let start: Date;
    let end: Date;

    if (query.month) {
      const [yStr, mStr] = query.month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      start = new Date(Date.UTC(y, m, 1));
      end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    } else if (query.startDate && query.endDate) {
      start = new Date(`${query.startDate}T00:00:00Z`);
      end = new Date(`${query.endDate}T23:59:59Z`);
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    }

    const items = await this.repo.getTeamCalendarLeaves(
      workspaceId,
      start,
      end,
      query.department,
      query.status
    );

    return items.map((r) => this.serializeRequest(r));
  }

  /**
   * Check staffing conflict for a pending or planned leave.
   */
  async checkStaffingConflict(
    tenantId: string,
    workspaceId: string,
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeRequestId?: string
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    return this.repo.checkStaffingConflict(
      workspaceId,
      employeeId,
      new Date(`${startDate}T00:00:00Z`),
      new Date(`${endDate}T23:59:59Z`),
      excludeRequestId
    );
  }

  /**
   * Calculate statutory termination payout for employee (California Labor Code § 227.3).
   */
  async calculateTerminationPayout(
    tenantId: string,
    workspaceId: string,
    input: CalculateTerminationPayoutInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const payout = await this.repo.calculateTerminationPayout(
      workspaceId,
      input.employeeId,
      input.hourlyRate ?? 25.0,
      input.year
    );

    if (!payout) {
      throw new NotFoundError("Employee not found in workspace");
    }

    return payout;
  }

  /**
   * Generate US payroll export dataset (regular hours + overtime + paid leave breakdown).
   */
  async getPayrollExport(
    tenantId: string,
    workspaceId: string,
    query: PayrollExportQueryInput
  ) {
    const valid = await this.repo.verifyWorkspaceTenant(workspaceId, tenantId);
    if (!valid) throw new NotFoundError("Workspace not found or unauthorized");

    const start = new Date(`${query.startDate}T00:00:00Z`);
    const end = new Date(`${query.endDate}T23:59:59Z`);

    if (start > end) {
      throw new ValidationError("startDate cannot be after endDate");
    }

    const data = await this.repo.getPayrollExportData(
      workspaceId,
      start,
      end,
      query.department
    );

    if (query.format === "csv") {
      const escape = (str: string | number) => {
        const val = String(str ?? "");
        return `"${val.replace(/"/g, '""')}"`;
      };

      const headers = [
        "Employee Code",
        "Employee Name",
        "Email",
        "Department",
        "Regular Hours",
        "Overtime Hours",
        "Vacation Hours",
        "Sick Leave Hours",
        "PTO Hours",
        "Other Paid Leave Hours",
        "Total Paid Leave Hours",
        "Total Paid Hours",
        "Unpaid Leave Hours",
      ];

      const csvLines = [headers.join(",")];

      for (const r of data.rows) {
        csvLines.push(
          [
            escape(r.employeeCode),
            escape(r.fullName),
            escape(r.email),
            escape(r.department),
            r.regularHours,
            r.overtimeHours,
            r.vacationHours,
            r.sickHours,
            r.ptoHours,
            r.otherPaidHours,
            r.totalPaidLeaveHours,
            r.totalPaidHours,
            r.unpaidHours,
          ].join(",")
        );
      }

      // Summary row
      csvLines.push("");
      csvLines.push(
        [
          escape("TOTALS"),
          escape("All Employees"),
          escape(""),
          escape(""),
          data.summary.totalRegularHours,
          data.summary.totalOvertimeHours,
          escape(""),
          escape(""),
          escape(""),
          escape(""),
          data.summary.totalPaidLeaveHours,
          data.summary.totalPaidHours,
          escape(""),
        ].join(",")
      );

      return {
        format: "csv",
        filename: `payroll-export-${query.startDate}-to-${query.endDate}.csv`,
        csv: csvLines.join("\r\n"),
        data,
      };
    }

    return {
      format: "json",
      data,
    };
  }
}

export const leaveServiceInstance = new LeaveService(new LeaveRepository());
