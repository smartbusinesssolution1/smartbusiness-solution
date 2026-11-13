import { clockInApi } from './apiClient';
import {
  AttendanceRegularization,
  RegularizationListResponse,
  SubmitRegularizationPayload,
  RegularizationStatus,
} from '../types';

export const regularizationService = {
  /**
   * List all regularization requests for workspace (Admin view)
   */
  async list(params: {
    workspaceId?: string;
    employeeId?: string;
    status?: RegularizationStatus | 'ALL';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<RegularizationListResponse> {
    const response = await clockInApi.get<{ success: boolean; data: RegularizationListResponse }>(
      '/api/v1/regularizations',
      { params }
    );
    return response.data.data;
  },

  /**
   * List logged-in employee's regularization requests
   */
  async getMy(params?: {
    workspaceId?: string;
    status?: RegularizationStatus | 'ALL';
    page?: number;
    limit?: number;
  }): Promise<RegularizationListResponse> {
    const response = await clockInApi.get<{ success: boolean; data: RegularizationListResponse }>(
      '/api/v1/regularizations/my',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get single regularization details
   */
  async getById(id: string, workspaceId?: string): Promise<AttendanceRegularization> {
    const response = await clockInApi.get<{ success: boolean; data: AttendanceRegularization }>(
      `/api/v1/regularizations/${id}`,
      { params: { workspaceId } }
    );
    return response.data.data;
  },

  /**
   * Submit new regularization request
   */
  async submit(payload: SubmitRegularizationPayload): Promise<AttendanceRegularization> {
    const response = await clockInApi.post<{ success: boolean; data: AttendanceRegularization; message: string }>(
      '/api/v1/regularizations',
      payload
    );
    return response.data.data;
  },

  /**
   * Admin approve regularization request
   */
  async approve(id: string, reviewerNotes?: string, workspaceId?: string): Promise<AttendanceRegularization> {
    const response = await clockInApi.post<{ success: boolean; data: AttendanceRegularization; message: string }>(
      `/api/v1/regularizations/${id}/approve`,
      { reviewerNotes, workspaceId }
    );
    return response.data.data;
  },

  /**
   * Admin reject regularization request
   */
  async reject(id: string, reviewerNotes?: string, workspaceId?: string): Promise<AttendanceRegularization> {
    const response = await clockInApi.post<{ success: boolean; data: AttendanceRegularization; message: string }>(
      `/api/v1/regularizations/${id}/reject`,
      { reviewerNotes, workspaceId }
    );
    return response.data.data;
  },

  /**
   * Employee or Admin cancel pending request
   */
  async cancel(id: string, workspaceId?: string): Promise<AttendanceRegularization> {
    const response = await clockInApi.post<{ success: boolean; data: AttendanceRegularization; message: string }>(
      `/api/v1/regularizations/${id}/cancel`,
      { workspaceId }
    );
    return response.data.data;
  },
};

export default regularizationService;
