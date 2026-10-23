import { clockInApi } from './apiClient';
import {
  OrganizationSettings,
  GeofenceSettingsResponse,
  UpdateGeofencePayload,
  WorkspaceGeofenceOverviewItem,
} from '../types';

export const settingsService = {
  /**
   * Fetch geofence configuration for a specific workspace (Admin endpoint)
   */
  async getGeofence(workspaceId: string): Promise<GeofenceSettingsResponse> {
    const response = await clockInApi.get<{ success: boolean; data: GeofenceSettingsResponse }>(
      `/api/v1/admin/attendance/geofences/${workspaceId}`
    );
    return response.data.data;
  },

  /**
   * Update or create geofence settings for a specific workspace (Admin endpoint)
   */
  async updateGeofence(
    workspaceId: string,
    payload: UpdateGeofencePayload
  ): Promise<{ message: string; geofence: any }> {
    const response = await clockInApi.put<{ success: boolean; data: any }>(
      `/api/v1/admin/attendance/geofences/${workspaceId}`,
      payload
    );
    return response.data.data;
  },

  /**
   * List all workspaces in organization with their geofence status (Admin endpoint)
   */
  async listOverview(): Promise<WorkspaceGeofenceOverviewItem[]> {
    const response = await clockInApi.get<{ success: boolean; data: WorkspaceGeofenceOverviewItem[] }>(
      `/api/v1/admin/attendance/geofences`
    );
    return response.data.data;
  },

  /**
   * Backward-compatible helper used across existing pages (CreateEmployee, EditEmployee, etc.)
   */
  async getSettings(workspaceId?: string): Promise<OrganizationSettings> {
    const rawWsId = workspaceId || localStorage.getItem('active_workspace_id');
    const activeWsId =
      rawWsId && rawWsId !== 'undefined' && rawWsId !== 'null' && rawWsId.trim() !== ''
        ? rawWsId.trim()
        : null;

    if (!activeWsId) {
      return {
        companyName: '',
        officeName: '',
        latitude: 0,
        longitude: 0,
        radius: 100,
        officeStartTime: '09:00',
        officeEndTime: '18:00',
      };
    }

    try {
      const data = await this.getGeofence(activeWsId);
      return {
        companyName: data.corporateName || '',
        officeName: data.workspaceName || '',
        latitude: data.geofence?.latitude ?? 0,
        longitude: data.geofence?.longitude ?? 0,
        radius: data.geofence?.radiusMeters ?? 100,
        officeStartTime: data.geofence?.defaultShiftStartTime ?? '09:00',
        officeEndTime: data.geofence?.defaultShiftEndTime ?? '18:00',
      };
    } catch {
      return {
        companyName: '',
        officeName: '',
        latitude: 0,
        longitude: 0,
        radius: 100,
        officeStartTime: '09:00',
        officeEndTime: '18:00',
      };
    }
  },

  /**
   * Backward-compatible updateSettings
   */
  async updateSettings(settings: any): Promise<any> {
    const rawWsId = settings.workspaceId || localStorage.getItem('active_workspace_id');
    const activeWsId =
      rawWsId && rawWsId !== 'undefined' && rawWsId !== 'null' && rawWsId.trim() !== ''
        ? rawWsId.trim()
        : null;

    if (!activeWsId) throw new Error('No active workspace selected.');

    return this.updateGeofence(activeWsId, {
      latitude: Number(settings.latitude),
      longitude: Number(settings.longitude),
      radiusMeters: Number(settings.radius ?? settings.radiusMeters ?? 100),
      graceMinutes: Number(settings.graceMinutes ?? 15),
      defaultShiftStartTime: settings.defaultShiftStartTime ?? settings.officeStartTime ?? '09:00',
      defaultShiftEndTime: settings.defaultShiftEndTime ?? settings.officeEndTime ?? '18:00',
    });
  },
};

export default settingsService;
