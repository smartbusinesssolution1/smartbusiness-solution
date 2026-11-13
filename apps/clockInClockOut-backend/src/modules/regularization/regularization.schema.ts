import { z } from "zod";

export const RegularizationReasonEnum = z.enum([
  "MISSED_CLOCK_IN",
  "MISSED_CLOCK_OUT",
  "MISSED_BOTH",
  "ON_DUTY_CLIENT_VISIT",
  "WORK_FROM_HOME",
  "TECHNICAL_ISSUE",
  "OTHER",
]);

export const RegularizationStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const SubmitRegularizationSchema = z
  .object({
    workspaceId: z.string().optional(),
    employeeId: z.string().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD"),
    reasonCategory: RegularizationReasonEnum,
    reasonText: z
      .string()
      .trim()
      .min(5, "Reason must be at least 5 characters")
      .max(500, "Reason cannot exceed 500 characters"),
    requestedClockInTime: z.string().optional().nullable(),
    requestedClockOutTime: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.requestedClockInTime && data.requestedClockOutTime) {
        const inTime = new Date(data.requestedClockInTime).getTime();
        const outTime = new Date(data.requestedClockOutTime).getTime();
        return outTime > inTime;
      }
      return true;
    },
    {
      message: "Requested clock-out time must be after clock-in time",
      path: ["requestedClockOutTime"],
    }
  );

export const ReviewRegularizationSchema = z.object({
  reviewerNotes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
});

export const ListRegularizationsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  employeeId: z.string().optional(),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"])
    .optional()
    .default("ALL"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type SubmitRegularizationInput = z.infer<typeof SubmitRegularizationSchema>;
export type ReviewRegularizationInput = z.infer<typeof ReviewRegularizationSchema>;
export type ListRegularizationsQueryInput = z.infer<typeof ListRegularizationsQuerySchema>;
