import { z } from "zod";

export const DayShiftConfigSchema = z.object({
  day: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  isWorkDay: z.boolean().default(true),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm format").default("09:00"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm format").default("18:00"),
});

export const WeeklyScheduleSchema = z.array(DayShiftConfigSchema);

export const PreprocessedWeeklyScheduleSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  // Support legacy map format { MON: { ... } } by normalizing to array [ { day: "MON", ... } ]
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
    return days.map((d) => {
      const dayData = (val as Record<string, any>)[d];
      return {
        day: d,
        isWorkDay: dayData?.isWorkDay ?? !["SAT", "SUN"].includes(d),
        startTime: dayData?.startTime || "09:00",
        endTime: dayData?.endTime || "18:00",
      };
    });
  }
  return val;
}, WeeklyScheduleSchema.optional().nullable());

export const CreateEmployeeSchema = z.object({
  employeeId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Full Name must be at least 2 characters"),
  email: z.string().trim().email("Valid business email is required").toLowerCase(),
  phone: z.string().trim().min(3, "Phone number must be at least 3 digits"),
  designation: z.string().trim().min(2, "Designation is required"),
  department: z.string().trim().min(2, "Department is required"),
  role: z.enum(["admin", "employee"]).default("employee"),
  status: z.enum(["active", "inactive"]).default("active"),
  shiftType: z.enum(["general", "custom"]).default("general"),
  shiftStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  shiftEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  weeklySchedule: PreprocessedWeeklyScheduleSchema,
  workspaceId: z.string().optional(),
  existingAvatarUrl: z.string().trim().optional(),
});

export const UpdateEmployeeSchema = z.object({
  employeeId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(3).optional(),
  designation: z.string().trim().min(2).optional(),
  department: z.string().trim().min(2).optional(),
  role: z.enum(["admin", "employee"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  shiftType: z.enum(["general", "custom"]).optional(),
  shiftStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  shiftEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  weeklySchedule: PreprocessedWeeklyScheduleSchema,
  workspaceId: z.string().optional(),
  existingAvatarUrl: z.string().trim().optional(),
});

export const EmployeeIdParamSchema = z.object({
  id: z.string().trim().min(1, "Employee ID is required"),
});

export const EmployeeListQuerySchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
  role: z.enum(["all", "admin", "employee"]).optional().default("all"),
  workspaceId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type DayShiftConfig = z.infer<typeof DayShiftConfigSchema>;
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type EmployeeIdParamInput = z.infer<typeof EmployeeIdParamSchema>;
export type EmployeeListQueryInput = z.infer<typeof EmployeeListQuerySchema>;
export type CheckEmployeeEmailQueryInput = z.infer<typeof CheckEmployeeEmailQuerySchema>;

export const CheckEmployeeEmailQuerySchema = z.object({
  email: z.string().trim().email("Valid email address is required").toLowerCase(),
  workspaceId: z.string().trim().optional(),
});
