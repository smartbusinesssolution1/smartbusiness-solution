import { clockInApi } from './apiClient';
import { User } from '../types';

export interface ExistingWorkspaceInfo {
  workspaceId: string;
  workspaceName: string;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
  role?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface CheckEmployeeEmailResult {
  exists: boolean;
  status?: 'EXISTS_CURRENT_WORKSPACE' | 'EXISTS_OTHER_WORKSPACE';
  message?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  existingWorkspaces?: ExistingWorkspaceInfo[];
}

export interface EmployeeFilterParams {
  search?: string;
  department?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
  workspaceId?: string;
}

export interface EmployeeListResult {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const employeeService = {
  async getEmployees(params?: EmployeeFilterParams): Promise<EmployeeListResult> {
    try {
      const response = await clockInApi.get('/api/v1/admin/employees', { params });
      // Backend returns { success: true, data: { items: User[], total, page, limit, totalPages } }
      if (response.data?.data && Array.isArray(response.data.data.items)) {
        return response.data.data;
      }
      if (response.data?.data && Array.isArray(response.data.data)) {
        return {
          items: response.data.data,
          total: response.data.data.length,
          page: 1,
          limit: response.data.data.length,
          totalPages: 1,
        };
      }
      if (Array.isArray(response.data)) {
        return {
          items: response.data,
          total: response.data.length,
          page: 1,
          limit: response.data.length,
          totalPages: 1,
        };
      }
      return { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch employees.';
      throw new Error(errorMsg);
    }
  },

  async getEmployee(id: string): Promise<User> {
    try {
      const response = await clockInApi.get(`/api/v1/admin/employees/${id}`);
      return response.data?.data || response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch employee details.';
      throw new Error(errorMsg);
    }
  },

  async createEmployee(formData: FormData): Promise<User> {
    try {
      const response = await clockInApi.post('/api/v1/admin/employees', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.originalMessage ||
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to register employee.';
      throw new Error(errorMsg);
    }
  },

  async updateEmployee(id: string, formData: FormData): Promise<User> {
    try {
      const response = await clockInApi.put(`/api/v1/admin/employees/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to update employee.';
      throw new Error(errorMsg);
    }
  },

  // Emails the employee their way in again: a new one-time "choose your password" link (an
  // older one stops working), or "you now have access" if they already have an account.
  async resendInvitation(id: string): Promise<void> {
    try {
      await clockInApi.post(`/api/v1/admin/employees/${id}/resend-invitation`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || "We couldn't send the invitation right now. Try again in a moment.");
    }
  },

  async checkEmail(email: string, workspaceId?: string): Promise<CheckEmployeeEmailResult> {
    try {
      const response = await clockInApi.get('/api/v1/admin/employees/check-email', {
        params: { email, workspaceId },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to check email availability.';
      throw new Error(errorMsg);
    }
  },

  async deleteEmployee(id: string): Promise<void> {
    try {
      await clockInApi.delete(`/api/v1/admin/employees/${id}`);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to delete employee.';
      throw new Error(errorMsg);
    }
  },
};

export default employeeService;
