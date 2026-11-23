import { clockInApi } from './apiClient';

export type LeaveCategory =
  | 'PTO'
  | 'VACATION'
  | 'SICK'
  | 'BEREAVEMENT'
  | 'JURY_DUTY'
  | 'MILITARY'
  | 'UNPAID'
  | 'FMLA';

export type LeaveAccrualType =
  | 'FRONTLOAD'
  | 'HOURLY_ACCRUAL'
  | 'PER_PAY_PERIOD'
  | 'UNLIMITED';

export type LeaveRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface LeavePolicy {
  id: string;
  workspaceId: string;
  name: string;
  code: string;
  description?: string | null;
  category: LeaveCategory;
  accrualType: LeaveAccrualType;
  rate: number;
  hoursPerYear: number;
  maxCarryoverHours: number;
  accrualCapHours?: number | null;
  waitingPeriodDays: number;
  minNoticeDays: number;
  isPaid: boolean;
  payoutOnTermination: boolean;
  requiresApproval: boolean;
  requiresDocDays?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface EmployeeLeaveBalance {
  id: string;
  employeeId: string;
  policyId: string;
  year: number;
  policy?: LeavePolicy;
  employee?: {
    id: string;
    employeeCode?: string;
    department?: string;
    createdAt?: string;
    workspaceMember?: {
      user?: {
        id: string;
        fullName?: string;
        email?: string;
      };
    };
  };
  allocatedHours: number;
  accruedHours: number;
  carriedOverHours: number;
  usedHours: number;
  pendingHours: number;
  availableHours: number;
}

export interface AssignLeaveBalancePayload {
  workspaceId?: string;
  employeeId: string;
  policyId: string;
  year?: number;
  allocatedHours: number;
  carriedOverHours?: number;
  hireDate?: string;
  notes?: string;
}

export interface StaffingConflictResult {
  hasConflict: boolean;
  severity: 'HIGH' | 'MEDIUM' | 'NONE';
  department: string;
  totalStaff: number;
  peersOnLeaveCount: number;
  peersOnLeaveNames: string[];
  conflictingDates: string[];
  remainingStaffCount: number;
  coveragePercentage: number;
  warningMessage: string | null;
}

export interface TerminationPayoutItem {
  policyId: string;
  policyName: string;
  policyCode: string;
  category: LeaveCategory;
  isPaid: boolean;
  payoutOnTermination: boolean;
  carriedOverHours: number;
  accruedHours: number;
  usedHours: number;
  pendingHours: number;
  availableHours: number;
  payoutHours: number;
  payoutAmount: number;
  retainedHours: number;
  requiresPayout: boolean;
  legalBasis: string;
}

export interface TerminationPayoutResult {
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string;
    department: string;
    designation: string;
  };
  hourlyRate: number;
  targetYear: number;
  items: TerminationPayoutItem[];
  totalPayoutHours: number;
  totalPayoutAmount: number;
  totalRetainedHours: number;
  complianceNotice: string[];
}

export interface PayrollExportRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  regularHours: number;
  overtimeHours: number;
  vacationHours: number;
  sickHours: number;
  ptoHours: number;
  otherPaidHours: number;
  totalPaidLeaveHours: number;
  unpaidHours: number;
  totalPaidHours: number;
}

export interface PayrollExportResult {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  department: string;
  summary: {
    totalEmployees: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalPaidLeaveHours: number;
    totalPaidHours: number;
  };
  rows: PayrollExportRow[];
}

export interface LeaveRequest {
  id: string;
  workspaceId: string;
  employeeId: string;
  policyId: string;
  status: LeaveRequestStatus;
  startDate: string;
  endDate: string;
  totalHours: number;
  isIntermittent: boolean;
  reason?: string | null;
  attachmentUrl?: string | null;
  reviewerId?: string | null;
  reviewerNotes?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  policy?: LeavePolicy;
  employee?: {
    id: string;
    employeeCode: string;
    designation?: string | null;
    department?: string | null;
    workspaceMember?: {
      user?: {
        id: string;
        fullName: string;
        email: string;
      };
    };
  };
  reviewer?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface CreateLeavePolicyPayload {
  name: string;
  code: string;
  description?: string;
  category?: LeaveCategory;
  accrualType?: LeaveAccrualType;
  rate?: number;
  hoursPerYear?: number;
  maxCarryoverHours?: number;
  accrualCapHours?: number;
  waitingPeriodDays?: number;
  minNoticeDays?: number;
  isPaid?: boolean;
  payoutOnTermination?: boolean;
  requiresApproval?: boolean;
  requiresDocDays?: number;
  isActive?: boolean;
  workspaceId?: string;
}

export interface SubmitLeaveRequestPayload {
  policyId: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  isIntermittent?: boolean;
  reason?: string;
  attachmentUrl?: string;
  employeeId?: string;
  workspaceId?: string;
}

export const leaveService = {
  // Policies
  async listPolicies(workspaceId?: string, isActive?: boolean): Promise<LeavePolicy[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (isActive !== undefined) params.isActive = isActive;

    const res = await clockInApi.get<{ success: boolean; data: LeavePolicy[] }>(
      '/api/v1/leaves/policies',
      { params }
    );
    return res.data.data;
  },

  async createPolicy(payload: CreateLeavePolicyPayload): Promise<LeavePolicy> {
    const res = await clockInApi.post<{ success: boolean; data: LeavePolicy; message?: string }>(
      '/api/v1/leaves/policies',
      payload
    );
    return res.data.data;
  },

  async updatePolicy(id: string, payload: Partial<CreateLeavePolicyPayload>, workspaceId?: string): Promise<LeavePolicy> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.put<{ success: boolean; data: LeavePolicy; message?: string }>(
      `/api/v1/leaves/policies/${id}`,
      payload,
      { params }
    );
    return res.data.data;
  },

  async deletePolicy(id: string, workspaceId?: string): Promise<void> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    await clockInApi.delete(`/api/v1/leaves/policies/${id}`, { params });
  },

  async seedUsPresets(workspaceId: string, presetType: string = 'ALL'): Promise<LeavePolicy[]> {
    const res = await clockInApi.post<{ success: boolean; data: LeavePolicy[]; message?: string }>(
      '/api/v1/leaves/policies/seed-us-presets',
      { presetType, workspaceId }
    );
    return res.data.data;
  },

  // Balances
  async getMyBalances(workspaceId?: string, year?: number): Promise<EmployeeLeaveBalance[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (year) params.year = year;

    const res = await clockInApi.get<{ success: boolean; data: EmployeeLeaveBalance[] }>(
      '/api/v1/leaves/balances/my',
      { params }
    );
    return res.data.data;
  },

  async getEmployeeBalances(employeeId: string, workspaceId?: string, year?: number): Promise<EmployeeLeaveBalance[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (year) params.year = year;

    const res = await clockInApi.get<{ success: boolean; data: EmployeeLeaveBalance[] }>(
      `/api/v1/leaves/balances/employee/${employeeId}`,
      { params }
    );
    return res.data.data;
  },

  async listWorkspaceBalances(workspaceId?: string, year?: number, employeeId?: string, policyId?: string): Promise<EmployeeLeaveBalance[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (year) params.year = year;
    if (employeeId) params.employeeId = employeeId;
    if (policyId) params.policyId = policyId;

    const res = await clockInApi.get<{ success: boolean; data: EmployeeLeaveBalance[] }>(
      '/api/v1/leaves/balances/summary',
      { params }
    );
    return res.data.data;
  },

  async assignOrAdjustBalance(payload: AssignLeaveBalancePayload): Promise<EmployeeLeaveBalance> {
    const res = await clockInApi.post<{ success: boolean; data: EmployeeLeaveBalance; message: string }>(
      '/api/v1/leaves/balances/assign',
      payload
    );
    return res.data.data;
  },

  async runPayPeriodAccruals(workspaceId?: string, year?: number): Promise<{ success: boolean; message: string; policiesProcessed: number; employeesProcessed: number; totalHoursAccrued: number }> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.post(
      '/api/v1/leaves/accruals/run-pay-period',
      { workspaceId, year },
      { params }
    );
    return res.data;
  },

  async runRollover(workspaceId: string, fromYear: number, toYear: number): Promise<{ success: boolean; message: string; rolledOverCount: number; totalHoursRolledOver: number }> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.post(
      '/api/v1/leaves/accruals/run-rollover',
      { workspaceId, fromYear, toYear },
      { params }
    );
    return res.data;
  },

  // Requests
  async submitRequest(payload: SubmitLeaveRequestPayload): Promise<LeaveRequest> {
    const res = await clockInApi.post<{ success: boolean; data: LeaveRequest; message?: string }>(
      '/api/v1/leaves/requests',
      payload
    );
    return res.data.data;
  },

  async listRequests(workspaceId?: string, status?: string): Promise<LeaveRequest[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (status && status !== 'ALL') params.status = status;

    const res = await clockInApi.get<{ success: boolean; data: LeaveRequest[] }>(
      '/api/v1/leaves/requests',
      { params }
    );
    return res.data.data;
  },

  async getMyRequests(workspaceId?: string): Promise<LeaveRequest[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.get<{ success: boolean; data: LeaveRequest[] }>(
      '/api/v1/leaves/requests/my',
      { params }
    );
    return res.data.data;
  },

  async reviewRequest(id: string, decision: 'APPROVED' | 'REJECTED', reviewerNotes?: string, workspaceId?: string): Promise<LeaveRequest> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.patch<{ success: boolean; data: LeaveRequest; message?: string }>(
      `/api/v1/leaves/requests/${id}/review`,
      { status: decision, reviewerNotes },
      { params }
    );
    return res.data.data;
  },

  async cancelRequest(id: string, workspaceId?: string): Promise<void> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    await clockInApi.post(`/api/v1/leaves/requests/${id}/cancel`, {}, { params });
  },

  // Team Calendar & Conflict Detection
  async getTeamCalendar(workspaceId?: string, month?: string, department?: string, status?: string): Promise<LeaveRequest[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;
    if (month) params.month = month;
    if (department && department !== 'ALL') params.department = department;
    if (status && status !== 'ALL') params.status = status;

    const res = await clockInApi.get<{ success: boolean; data: LeaveRequest[] }>(
      '/api/v1/leaves/calendar',
      { params }
    );
    return res.data.data;
  },

  async checkStaffingConflict(
    workspaceId: string,
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeRequestId?: string
  ): Promise<StaffingConflictResult> {
    const params: Record<string, any> = {
      workspaceId,
      employeeId,
      startDate,
      endDate,
    };
    if (excludeRequestId) params.excludeRequestId = excludeRequestId;

    const res = await clockInApi.get<{ success: boolean; data: StaffingConflictResult }>(
      '/api/v1/leaves/conflict-check',
      { params }
    );
    return res.data.data;
  },

  async listDepartments(workspaceId?: string): Promise<string[]> {
    const params: Record<string, any> = {};
    if (workspaceId) params.workspaceId = workspaceId;

    const res = await clockInApi.get<{ success: boolean; data: string[] }>(
      '/api/v1/leaves/departments',
      { params }
    );
    return res.data.data;
  },

  // US Statutory Termination Payout & Payroll Exports
  async calculateTerminationPayout(
    employeeId: string,
    hourlyRate: number = 25.0,
    workspaceId?: string,
    year?: number
  ): Promise<TerminationPayoutResult> {
    const params: Record<string, any> = {
      employeeId,
      hourlyRate,
    };
    if (workspaceId) params.workspaceId = workspaceId;
    if (year) params.year = year;

    const res = await clockInApi.get<{ success: boolean; data: TerminationPayoutResult }>(
      '/api/v1/leaves/termination-payout',
      { params }
    );
    return res.data.data;
  },

  async getPayrollExport(
    startDate: string,
    endDate: string,
    workspaceId?: string,
    department?: string
  ): Promise<PayrollExportResult> {
    const params: Record<string, any> = {
      startDate,
      endDate,
      format: 'json',
    };
    if (workspaceId) params.workspaceId = workspaceId;
    if (department && department !== 'ALL') params.department = department;

    const res = await clockInApi.get<{ success: boolean; data: PayrollExportResult }>(
      '/api/v1/leaves/payroll-export',
      { params }
    );
    return res.data.data;
  },

  async downloadPayrollCsv(
    startDate: string,
    endDate: string,
    workspaceId?: string,
    department?: string
  ): Promise<void> {
    const params: Record<string, any> = {
      startDate,
      endDate,
      format: 'csv',
    };
    if (workspaceId) params.workspaceId = workspaceId;
    if (department && department !== 'ALL') params.department = department;

    const res = await clockInApi.get('/api/v1/leaves/payroll-export', {
      params,
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll-export-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async uploadLeaveDocument(file: File, workspaceId?: string): Promise<{ url: string; key?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (workspaceId) formData.append('workspaceId', workspaceId);

    const res = await clockInApi.post<{ success: boolean; data: { url: string; key?: string } }>(
      '/api/v1/leaves/upload-document',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data.data;
  },
};
