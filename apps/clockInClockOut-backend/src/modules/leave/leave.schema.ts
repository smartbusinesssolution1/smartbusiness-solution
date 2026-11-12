import { z } from "zod";

export const LeaveCategoryEnum = z.enum([
  "PTO",
  "VACATION",
  "SICK",
  "BEREAVEMENT",
  "JURY_DUTY",
  "MILITARY",
  "UNPAID",
  "FMLA",
]);

export const LeaveAccrualTypeEnum = z.enum([
  "FRONTLOAD",
  "HOURLY_ACCRUAL",
  "PER_PAY_PERIOD",
  "UNLIMITED",
]);

export const LeaveRequestStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const CreateLeavePolicySchema = z.object({
  name: z.string().trim().min(2, "Policy name must be at least 2 characters").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Policy code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens, and underscores")
    .transform((val) => val.toUpperCase()),
  description: z.string().trim().max(500).optional().nullable(),
  category: LeaveCategoryEnum.default("PTO"),
  accrualType: LeaveAccrualTypeEnum.default("HOURLY_ACCRUAL"),
  rate: z.coerce.number().min(0, "Rate cannot be negative").default(0),
  hoursPerYear: z.coerce.number().min(0, "Hours per year cannot be negative").default(40.0),
  maxCarryoverHours: z.coerce.number().min(0).default(0),
  accrualCapHours: z.coerce.number().min(0).optional().nullable(),
  waitingPeriodDays: z.coerce.number().int().min(0).default(0),
  minNoticeDays: z.coerce.number().int().min(0).default(0),
  isPaid: z.boolean().default(true),
  payoutOnTermination: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  requiresDocDays: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
});

export const UpdateLeavePolicySchema = CreateLeavePolicySchema.partial();

export const SubmitLeaveRequestSchema = z.object({
  policyId: z.string().uuid("Invalid policy ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  totalHours: z.coerce
    .number()
    .min(0.5, "Minimum request is 0.5 hours (30 minutes)")
    .max(480, "Maximum single request cannot exceed 480 hours (12 weeks)"),
  isIntermittent: z.boolean().default(false),
  reason: z.string().trim().max(1000).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
  employeeId: z.string().uuid("Invalid employee ID").optional(),
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
});

export const ReviewLeaveRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewerNotes: z.string().trim().max(500).optional().nullable(),
});

export const ListLeaveRequestsQuerySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  employeeId: z.string().uuid("Invalid employee ID").optional(),
  policyId: z.string().uuid("Invalid policy ID").optional(),
  status: LeaveRequestStatusEnum.or(z.literal("ALL")).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const RunPayPeriodAccrualSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export const RunRolloverSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  fromYear: z.coerce.number().int().min(2020).max(2100),
  toYear: z.coerce.number().int().min(2020).max(2100),
});

export const ListWorkspaceBalancesQuerySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  employeeId: z.string().uuid("Invalid employee ID").optional(),
  policyId: z.string().uuid("Invalid policy ID").optional(),
});

export const GetTeamCalendarQuerySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be format YYYY-MM").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  department: z.string().trim().optional(),
  status: z.enum(["APPROVED", "PENDING", "ALL"]).default("ALL"),
});

export const CheckConflictQuerySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  employeeId: z.string().uuid("Invalid employee ID").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  excludeRequestId: z.string().uuid().optional(),
});

export const CalculateTerminationPayoutSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  employeeId: z.string().uuid("Invalid employee ID"),
  hourlyRate: z.coerce.number().min(0, "Hourly rate must be non-negative").default(25.0),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export const PayrollExportQuerySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  department: z.string().trim().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

export const AssignLeaveBalanceSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  employeeId: z.string().uuid("Invalid employee ID"),
  policyId: z.string().uuid("Invalid policy ID"),
  year: z.coerce.number().int().min(2020).max(2100).default(() => new Date().getFullYear()),
  allocatedHours: z.coerce.number().min(0, "Allocated hours cannot be negative").max(1000),
  carriedOverHours: z.coerce.number().min(0, "Carried over hours cannot be negative").max(1000).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "hireDate must be YYYY-MM-DD").optional(),
  notes: z.string().max(500).optional(),
});

export type CreateLeavePolicyInput = z.infer<typeof CreateLeavePolicySchema>;
export type CreateLeavePolicyRawInput = z.input<typeof CreateLeavePolicySchema>;
export type UpdateLeavePolicyInput = z.infer<typeof UpdateLeavePolicySchema>;
export type SubmitLeaveRequestInput = z.infer<typeof SubmitLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof ReviewLeaveRequestSchema>;
export type ListLeaveRequestsQueryInput = z.infer<typeof ListLeaveRequestsQuerySchema>;
export type RunPayPeriodAccrualInput = z.infer<typeof RunPayPeriodAccrualSchema>;
export type RunRolloverInput = z.infer<typeof RunRolloverSchema>;
export type ListWorkspaceBalancesQueryInput = z.infer<typeof ListWorkspaceBalancesQuerySchema>;
export type GetTeamCalendarQueryInput = z.infer<typeof GetTeamCalendarQuerySchema>;
export type CheckConflictQueryInput = z.infer<typeof CheckConflictQuerySchema>;
export type CalculateTerminationPayoutInput = z.infer<typeof CalculateTerminationPayoutSchema>;
export type PayrollExportQueryInput = z.infer<typeof PayrollExportQuerySchema>;
export type AssignLeaveBalanceInput = z.infer<typeof AssignLeaveBalanceSchema>;
