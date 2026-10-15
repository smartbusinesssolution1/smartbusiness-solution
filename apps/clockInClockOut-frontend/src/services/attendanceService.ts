import { clockInApi } from './apiClient';
import { getAttendance } from './mockDb';
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
        'Authentication required.';

      console.warn(
        'Live /api/v1/admin/attendance not reachable with current session, using local fallback:',
        serverMsg
      );

      // Graceful Fallback: Local dataset so admin view is never broken
      const allMock = getAttendance();
      const search = params?.search?.toLowerCase();
      const status = params?.status?.toLowerCase();
      const date = params?.date;

      const filtered = allMock.filter((record) => {
        const matchesSearch =
          !search ||
          record.employeeName.toLowerCase().includes(search) ||
          record.employeeId.toLowerCase().includes(search);
        const matchesStatus = !status || status === 'all' || record.status.toLowerCase() === status;
        const matchesDate = !date || record.date === date;
        return matchesSearch && matchesStatus && matchesDate;
      });

      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const paginatedItems = filtered.slice((page - 1) * limit, page * limit);

      const nonAbsent = filtered.filter((r) => r.status !== 'absent');
      const totalShifts = nonAbsent.length;
      const lateCount = filtered.filter((r) => r.status === 'late').length;
      const latePercentage = totalShifts > 0 ? Math.round((lateCount / totalShifts) * 100) : 0;
      const completedShifts = filtered.filter((r) => r.workingHours > 0);
      const avgHours =
        completedShifts.length > 0
          ? parseFloat(
            (
              completedShifts.reduce((sum, r) => sum + r.workingHours, 0) /
              completedShifts.length
            ).toFixed(1)
          )
          : 0;

      const absentCount = filtered.filter((r) => r.status === 'absent').length;

      return {
        items: paginatedItems,
        pagination: {
          total: filtered.length,
          page,
          limit,
          totalPages: Math.ceil(filtered.length / limit) || 1,
        },
        summary: {
          totalShifts,
          lateCount,
          latePercentage,
          averageWorkingHours: avgHours,
          absentCount,
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
      return getAttendance();
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
      const d = response.data?.data || {};
      return {
        totalEmployees: d.totalEmployees ?? 0,
        presentToday: d.presentToday ?? 0,
        lateToday: d.lateToday ?? 0,
        autoClosedToday: d.autoClosedToday ?? 0,
        attendanceRate: d.attendanceRate ?? 100,
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
      const all = getAttendance();
      return all.filter((r) => r.employeeId === employeeId);
    }
  },

  async getMyDashboardMetrics(employeeId: string): Promise<EmployeeDashboardMetrics> {
    try {
      const response = await clockInApi.get(`/api/v1/attendance/my/${employeeId}/metrics`);
      return response.data?.data || response.data;
    } catch {
      const all = getAttendance().filter((r) => r.employeeId === employeeId);
      const todayStr = new Date().toISOString().split('T')[0];
      const todayAttendance = all.find((r) => r.date === todayStr) || null;
      const present = all.filter((r) => r.status === 'present' || r.status === 'late').length;
      const late = all.filter((r) => r.status === 'late').length;
      const hours = all.reduce((sum, r) => sum + r.workingHours, 0);

      return {
        todayAttendance,
        totalPresent: present,
        totalLate: late,
        totalWorkingHours: parseFloat(hours.toFixed(1)),
        attendanceRate: all.length > 0 ? Math.round((present / all.length) * 100) : 100,
        recentAttendance: all.slice(0, 5),
      };
    }
  },

  async checkIn(formData: FormData): Promise<AttendanceRecord> {
    const response = await clockInApi.post('/api/v1/attendance/check-in', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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
   * Client-side fallback generator for offline or unauthenticated demo sessions
   */
  async fallbackClientExport(params: ExportReportParams): Promise<ExportReportResponse> {
    const all = getAttendance();
    const search = params.search?.toLowerCase();
    const status = params.status?.toLowerCase();
    const date = params.date;

    const filtered = all.filter((r) => {
      const matchSearch =
        !search ||
        r.employeeName.toLowerCase().includes(search) ||
        r.employeeId.toLowerCase().includes(search);
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
