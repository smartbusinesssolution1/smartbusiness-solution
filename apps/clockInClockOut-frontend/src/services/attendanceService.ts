import axios from 'axios';
import { AttendanceRecord, AdminDashboardMetrics, EmployeeDashboardMetrics } from '../types';

export const attendanceService = {
  async getMyAttendance(employeeId: string): Promise<AttendanceRecord[]> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/attendance/my/${employeeId}`);
    return response.data;
  },

  async getMyDashboardMetrics(employeeId: string): Promise<EmployeeDashboardMetrics> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/attendance/my/${employeeId}/metrics`);
    return response.data;
  },

  async checkIn(formData: FormData): Promise<AttendanceRecord> {
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/attendance/check-in`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async checkOut(employeeId: string): Promise<AttendanceRecord> {
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/attendance/check-out`, { employeeId });
    return response.data;
  },

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/attendance`);
    return response.data;
  },

  async getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/attendance/admin/metrics`);
    return response.data;
  },
};

export default attendanceService;
