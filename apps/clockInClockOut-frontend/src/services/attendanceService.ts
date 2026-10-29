import { clockInApi } from './apiClient';
import {
  AttendanceRecord,
  AdminAttendanceReportResponse,
  AdminDashboardMetrics,
} from '../types';

export interface AdminAttendanceFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
}

export type AdminAttendanceReportResult = AdminAttendanceReportResponse & {
  isLive: boolean;
  errorMessage?: string;
};

export interface ExportReportParams {
  format: 'xlsx' | 'csv' | 'pdf';
  search?: string;
  status?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
}

export interface ExportReportResponse {
  downloadUrl: string;
  filename: string;
  format: string;
  totalRecords: number;
}

export const attendanceService = {
  /**
   * Admin: Get paginated attendance report with multi-criteria filters & KPI summaries.
   * Connects to live backend /api/v1/admin/attendance, with seamless fallback if local session is unauthenticated.
   */
  async getAdminAttendanceReport(
    params?: AdminAttendanceFilterParams
  ): Promise<AdminAttendanceReportResult> {
    try {
      const response = await clockInApi.get<{
        success: boolean;
        data: AdminAttendanceReportResponse;
      }>('/api/v1/admin/attendance', { params });

      if (response.data?.success && response.data?.data) {
        return {
          ...response.data.data,
          isLive: true,
        };
      }
      throw new Error('Invalid backend response');
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch attendance report.';

      return {
        items: [],
        pagination: {
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
          totalPages: 0,
        },
        summary: {
          totalShifts: 0,
          lateCount: 0,
          latePercentage: 0,
          averageWorkingHours: 0,
          absentCount: 0,
        },
        isLive: false,
        errorMessage: serverMsg,
      };
    }
  },

  /**
   * Backward-compatible helper that returns AttendanceRecord[] for existing dashboard callers
   */
  async getAllAttendance(params?: AdminAttendanceFilterParams): Promise<AttendanceRecord[]> {
    try {
      const data = await this.getAdminAttendanceReport(params);
      return data?.items || [];
    } catch {
      return [];
    }
  },

  /**
   * Admin: Get high-level attendance summary KPIs
   */
  async getAdminDashboardMetrics(workspaceId?: string): Promise<AdminDashboardMetrics> {
    try {
      const response = await clockInApi.get<{ success: boolean; data: any }>(
        '/api/v1/admin/attendance/summary',
        { params: workspaceId ? { workspaceId } : undefined }
      );
      if (!response.data?.success) {
        throw new Error('Summary fetch failed');
      }
      const d = response.data?.data || {};
      return {
        totalEmployees: d.totalEmployees ?? 0,
        presentToday: d.presentToday ?? 0,
        lateToday: d.lateToday ?? 0,
        autoClosedToday: d.autoClosedToday ?? 0,
        attendanceRate: d.attendanceRate ?? 0,
        weeklyStats: Array.isArray(d.weeklyStats) ? d.weeklyStats : [],
        departmentStats: Array.isArray(d.departmentStats) ? d.departmentStats : [],
      };
    } catch {
      return {
        totalEmployees: 0,
        presentToday: 0,
        lateToday: 0,
        autoClosedToday: 0,
        attendanceRate: 0,
        weeklyStats: [],
        departmentStats: [],
      };
    }
  },

  /**
   * Admin: Request backend to generate and export audit report (Excel, CSV, PDF), returning public download URL
   */
  async exportAuditReport(params: ExportReportParams): Promise<ExportReportResponse> {
    const response = await clockInApi.post<{
      success: boolean;
      data: ExportReportResponse;
    }>('/api/v1/admin/attendance/export', params);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error('Backend export did not return valid file metadata');
  },
};

export default attendanceService;
