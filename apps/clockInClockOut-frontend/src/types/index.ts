export type UserRole = 'admin' | 'employee' | 'super_admin';

export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Tenant {
  id: string;
  name: string;
  role?: TenantRole;
  status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  billingEmail?: string;
}

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  isDefault?: boolean;
  employeeCount?: number;
  role?: string;
  userRole?: string;
  createdAt?: string;
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface DayShiftConfig {
  day: DayOfWeek;
  isWorkDay: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export type WeeklySchedule = DayShiftConfig[];

export interface User {
  id: string;
  userId?: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isSuperAdmin?: boolean;
  status: 'active' | 'inactive';
  designation: string;
  department: string;
  joinedDate: string;
  avatarUrl?: string;
  shiftType?: 'general' | 'custom';
  shiftStartTime?: string;
  shiftEndTime?: string;
  weeklySchedule?: WeeklySchedule;
}

export interface AttendanceSessionLog {
  id: string;
  sessionNumber: number;
  isFirstSession?: boolean;
  checkIn: string | null;
  checkOut: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'auto_closed';
  workingHours: number;
  notes?: string | null;
  clockInFaceMatchConfidence?: number | null;
  clockInLatitude?: number | null;
  clockInLongitude?: number | null;
  clockOutFaceMatchConfidence?: number | null;
  clockOutLatitude?: number | null;
  clockOutLongitude?: number | null;
  isAutoClosed?: boolean;
  distanceMeters?: number | null;
  locationName?: string | null;
  punchType?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  avatarUrl?: string | null;
  date: string; // YYYY-MM-DD
  checkIn: string | null; // HH:mm:ss or null (First clock-in)
  checkOut: string | null; // HH:mm:ss or null (Last clock-out)
  status: 'present' | 'absent' | 'late' | 'half_day' | 'auto_closed';
  workingHours: number; // in hours (Total sum)
  notes?: string;
  workspaceId?: string;
  workspaceName?: string;
  totalSessions?: number;
  sessions?: AttendanceSessionLog[];
  sessionNumber?: number;
  isFirstSession?: boolean;
}

export interface AttendanceReportSummary {
  totalShifts: number;
  lateCount: number;
  latePercentage: number;
  averageWorkingHours: number;
  absentCount?: number;
}

export interface AdminAttendanceReportResponse {
  items: AttendanceRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: AttendanceReportSummary;
}

export interface WorkspaceGeofenceDetails {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  graceMinutes: number;
  defaultShiftStartTime: string;
  defaultShiftEndTime: string;
  updatedAt?: string;
}

export interface GeofenceSettingsResponse {
  corporateName: string;
  tenantId: string;
  workspaceId: string;
  workspaceName: string;
  address?: string;
  isConfigured: boolean;
  geofence: WorkspaceGeofenceDetails | null;
}

export interface UpdateGeofencePayload {
  corporateName?: string;
  organizationName?: string;
  workspaceName?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  graceMinutes?: number;
  defaultShiftStartTime: string;
  defaultShiftEndTime: string;
}

export interface WorkspaceGeofenceOverviewItem {
  corporateName: string;
  tenantId: string;
  workspaceId: string;
  workspaceName: string;
  address: string;
  isConfigured: boolean;
  radiusMeters: number | null;
  defaultShiftStartTime: string | null;
  defaultShiftEndTime: string | null;
  graceMinutes: number | null;
}

export interface OrganizationSettings {
  companyName: string;
  officeName: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  officeStartTime: string; // HH:mm
  officeEndTime: string; // HH:mm
}

export interface DepartmentAttendanceStat {
  name: string;
  rate: number;
  present: number;
  late: number;
  absent: number;
  total?: number;
}

export interface AdminDashboardMetrics {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  autoClosedToday: number;
  attendanceRate: number;
  absentCount?: number;
  weeklyStats: {
    day: string;
    present: number;
    late: number;
    absent: number;
  }[];
  departmentStats?: DepartmentAttendanceStat[];
}

export interface TodaySessionInfo {
  id: string;
  sessionNumber: number;
  checkIn: string;
  checkOut: string | null;
  workingHours: number;
  status: string;
  isActive: boolean;
}

export interface EmployeeDashboardMetrics {
  todayAttendance: AttendanceRecord | null;
  totalPresent: number;
  totalLate: number;
  totalWorkingHours: number;
  attendanceRate: number;
  recentAttendance: AttendanceRecord[];
  hasActiveSession?: boolean;
  activeSessionId?: string | null;
  todaySessions?: TodaySessionInfo[];
}
