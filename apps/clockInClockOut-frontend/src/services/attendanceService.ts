import { clockInApi } from './apiClient';
import {
  AttendanceRecord,
  AdminAttendanceReportResponse,
  AdminDashboardMetrics,
  EmployeeDashboardMetrics,
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

export interface CheckInPayload {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  employeeId?: string;
  employeeName?: string;
  workspaceId?: string;
  notes?: string;
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

  async getMyAttendance(employeeId: string): Promise<AttendanceRecord[]> {
    try {
      const response = await clockInApi.get(`/api/v1/attendance/my/${employeeId}`);
      return response.data?.data || response.data || [];
    } catch {
      return [];
    }
  },

  async getMyDashboardMetrics(employeeId: string): Promise<EmployeeDashboardMetrics> {
    try {
      const response = await clockInApi.get(`/api/v1/attendance/my/${employeeId}/metrics`);
      return response.data?.data || response.data;
    } catch {
      return {
        todayAttendance: null,
        totalPresent: 0,
        totalLate: 0,
        totalWorkingHours: 0,
        attendanceRate: 0,
        recentAttendance: [],
      };
    }
  },

  async checkIn(payload: FormData | CheckInPayload): Promise<AttendanceRecord> {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await clockInApi.post(
      '/api/v1/attendance/check-in',
      payload,
      isFormData ? undefined : { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data?.data || response.data;
  },

  async checkOut(employeeId: string): Promise<AttendanceRecord> {
    const response = await clockInApi.post('/api/v1/attendance/check-out', { employeeId });
    return response.data?.data || response.data;
  },

  /**
   * Admin: Request backend to generate and export audit report (Excel, CSV, PDF), returning public download URL
   */
  async exportAuditReport(params: ExportReportParams): Promise<ExportReportResponse> {
    try {
      const response = await clockInApi.post<{
        success: boolean;
        data: ExportReportResponse;
      }>('/api/v1/admin/attendance/export', params);

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      throw new Error('Backend export did not return valid file metadata');
    } catch (err: any) {
      console.warn('Backend export failed or unauthenticated, falling back to client-side generation:', err);
      return this.fallbackClientExport(params);
    }
  },

  /**
   * Client-side export generator using live backend attendance records
   */
  async fallbackClientExport(params: ExportReportParams): Promise<ExportReportResponse> {
    const report = await this.getAdminAttendanceReport({
      search: params.search,
      status: params.status,
      date: params.date,
      workspaceId: params.workspaceId,
      limit: 1000,
    });

    const all = report.items || [];
    const search = params.search?.toLowerCase();
    const status = params.status?.toLowerCase();
    const date = params.date;

    const filtered = all.filter((r) => {
      const matchSearch =
        !search ||
        (r.employeeName && r.employeeName.toLowerCase().includes(search)) ||
        (r.employeeId && r.employeeId.toLowerCase().includes(search));
      const matchStatus = !status || status === 'all' || r.status.toLowerCase() === status;
      const matchDate = !date || r.date === date;
      return matchSearch && matchStatus && matchDate;
    });

    const format = params.format || 'xlsx';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `attendance_audit_${dateStr}_${Date.now()}.${format}`;

    if (format === 'csv') {
      const headers = ['Date', 'Employee ID', 'Employee Name', 'Check In', 'Check Out', 'Status', 'Working Hours', 'Notes'];
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = filtered.map((r) => [
        escape(r.date),
        escape(r.employeeId),
        escape(r.employeeName),
        escape(r.checkIn || '--'),
        escape(r.checkOut || '--'),
        escape(r.status.toUpperCase()),
        escape(`${r.workingHours} hrs`),
        escape(r.notes || '--'),
      ]);
      const csvStr = '\uFEFF' + [headers.map(escape).join(','), ...rows.map((row) => row.join(','))].join('\r\n');
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      return { downloadUrl, filename, format, totalRecords: filtered.length };
    }

    if (format === 'xlsx') {
      const XLSX = await import('xlsx');
      const headers = ['Date', 'Employee ID', 'Employee Name', 'Check In', 'Check Out', 'Status', 'Working Hours', 'Notes'];
      const rows = filtered.map((r) => [
        r.date,
        r.employeeId,
        r.employeeName,
        r.checkIn || '--',
        r.checkOut || '--',
        r.status.toUpperCase(),
        r.workingHours,
        r.notes || '--',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Audit');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = URL.createObjectURL(blob);
      return { downloadUrl, filename, format, totalRecords: filtered.length };
    }

    // PDF fallback
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.text('SmartBusiness - Attendance Audit Report', 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()} · Total Records: ${filtered.length}`, 40, 60);

    const tableRows = filtered.map((r) => [
      r.date,
      r.employeeId,
      r.employeeName,
      r.checkIn || '--',
      r.checkOut || '--',
      r.status.toUpperCase(),
      `${r.workingHours} hrs`,
      r.notes || '--',
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Date', 'Employee ID', 'Employee Name', 'Check-In', 'Check-Out', 'Status', 'Hours', 'Notes']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    const pdfBlob = doc.output('blob');
    const downloadUrl = URL.createObjectURL(pdfBlob);
    return { downloadUrl, filename, format, totalRecords: filtered.length };
  },
};

export default attendanceService;
