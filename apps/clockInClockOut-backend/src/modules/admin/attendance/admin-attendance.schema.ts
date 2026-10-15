import { z } from "zod";

const emptyToUndefined = (val: unknown) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "all") {
      return undefined;
    }
    return trimmed;
  }
  return val;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AdminAttendanceQuerySchema = z.object({
  page: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => (val ? Number(val) : 10), z.number().int().min(1).max(100).default(10)),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess((val) => {
    if (!val || val === "all" || val === "") return "all";
    return String(val).toLowerCase();
  }, z.enum(["all", "present", "late", "absent", "half_day", "auto_closed"]).default("all")),
  date: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "StartDate must be in YYYY-MM-DD format").optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "EndDate must be in YYYY-MM-DD format").optional()),
  workspaceId: z.preprocess((val) => {
    const clean = emptyToUndefined(val);
    if (!clean || typeof clean !== "string") return undefined;
    // Accept standard 8-4-4-4-12 hex UUIDs (including synthetic ones like 30000000-0000-0000-0000-000000000001)
    if (uuidRegex.test(clean)) return clean;
    return undefined;
  }, z.string().optional()),
});

export type AdminAttendanceQueryInput = z.infer<typeof AdminAttendanceQuerySchema>;

export const AdminAttendanceExportSchema = z.object({
  format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess((val) => {
    if (!val || val === "all" || val === "") return "all";
    return String(val).toLowerCase();
  }, z.enum(["all", "present", "late", "absent", "half_day", "auto_closed"]).default("all")),
  date: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "StartDate must be in YYYY-MM-DD format").optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "EndDate must be in YYYY-MM-DD format").optional()),
  workspaceId: z.preprocess((val) => {
    const clean = emptyToUndefined(val);
    if (!clean || typeof clean !== "string") return undefined;
    if (uuidRegex.test(clean)) return clean;
    return undefined;
  }, z.string().optional()),
});

export type AdminAttendanceExportInput = z.infer<typeof AdminAttendanceExportSchema>;

export interface FormattedAttendanceItem {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  avatarUrl: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "late" | "absent" | "half_day" | "auto_closed";
  workingHours: number;
  notes: string;
  workspaceId: string;
  workspaceName: string;
}

export interface AttendanceSummaryMetrics {
  totalShifts: number;
  lateCount: number;
  latePercentage: number;
  averageWorkingHours: number;
  absentCount: number;
}

export interface WeeklyAttendanceStat {
  day: string;
  present: number;
  late: number;
  absent: number;
}

export interface DepartmentAttendanceStat {
  name: string;
  rate: number;
  present: number;
  late: number;
  absent: number;
  total: number;
}

export interface AdminSummaryMetrics {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  autoClosedToday: number;
  attendanceRate: number;
  weeklyStats: WeeklyAttendanceStat[];
  departmentStats: DepartmentAttendanceStat[];
}

