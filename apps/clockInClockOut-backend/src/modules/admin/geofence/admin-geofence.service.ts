import { AdminGeofenceRepository } from "./admin-geofence.repository.js";
import { NotFoundError, AppError } from "../../../shared/errors/index.js";
import type { UpdateGeofenceInput } from "./admin-geofence.schema.js";

export class AdminGeofenceService {
  constructor(private geofenceRepo: AdminGeofenceRepository) {}

  /**
   * Get geofence details for a workspace, including corporate name
   */
  async getWorkspaceGeofence(workspaceId: string, tenantId: string) {
    const workspace = await this.geofenceRepo.findWorkspaceById(workspaceId, tenantId);
    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    const settings = workspace.attendanceSettings;
    return {
      corporateName: workspace.tenant.name,
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      workspaceName: workspace.businessName,
      address: [workspace.addressLine1, workspace.city, workspace.state].filter(Boolean).join(", "),
      isConfigured: Boolean(settings),
      geofence: settings
        ? {
            latitude: Number(settings.latitude),
            longitude: Number(settings.longitude),
            radiusMeters: settings.radiusMeters,
            graceMinutes: settings.graceMinutes ?? 15,
            defaultShiftStartTime: settings.defaultShiftStartTime ?? "09:00",
            defaultShiftEndTime: settings.defaultShiftEndTime ?? "18:00",
            updatedAt: settings.updatedAt?.toISOString?.() ?? settings.updatedAt,
          }
        : null,
    };
  }

  /**
   * Update or create geofence settings for a workspace
   */
  async updateWorkspaceGeofence(workspaceId: string, tenantId: string, input: UpdateGeofenceInput) {
    const workspace = await this.geofenceRepo.findWorkspaceById(workspaceId, tenantId);
    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    if (input.defaultShiftStartTime === input.defaultShiftEndTime) {
      throw new AppError("Shift start time and end time cannot be identical.", 400, "INVALID_SHIFT_HOURS");
    }

    let updatedCorporateName = workspace.tenant.name;
    const orgName = (input.corporateName || input.organizationName)?.trim();
    if (orgName && orgName !== workspace.tenant.name) {
      const updatedTenant = await this.geofenceRepo.updateTenantName(tenantId, orgName);
      updatedCorporateName = updatedTenant.name;
    }

    let updatedWorkspaceName = workspace.businessName;
    const wsName = input.workspaceName?.trim();
    if (wsName && wsName !== workspace.businessName) {
      const updatedWs = await this.geofenceRepo.updateWorkspaceName(workspaceId, tenantId, wsName);
      updatedWorkspaceName = updatedWs.businessName;
    }

    const saved = await this.geofenceRepo.upsertGeofence(workspaceId, input);

    return {
      message: "Organization geofence perimeter and campus settings updated successfully.",
      corporateName: updatedCorporateName,
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      workspaceName: updatedWorkspaceName,
      geofence: {
        latitude: Number(saved.latitude),
        longitude: Number(saved.longitude),
        radiusMeters: saved.radiusMeters,
        graceMinutes: saved.graceMinutes ?? 15,
        defaultShiftStartTime: saved.defaultShiftStartTime,
        defaultShiftEndTime: saved.defaultShiftEndTime,
        updatedAt: saved.updatedAt?.toISOString?.() ?? saved.updatedAt,
      },
    };
  }

  /**
   * List overview of all workspaces and their geofence status for the tenant
   */
  async listOverview(tenantId: string) {
    const workspaces = await this.geofenceRepo.listTenantWorkspacesWithGeofence(tenantId);
    return workspaces.map((w) => {
      const s = w.attendanceSettings;
      return {
        corporateName: w.tenant.name,
        tenantId: w.tenantId,
        workspaceId: w.id,
        workspaceName: w.businessName,
        address: [w.addressLine1, w.city, w.state].filter(Boolean).join(", "),
        isConfigured: Boolean(s),
        radiusMeters: s ? s.radiusMeters : null,
        defaultShiftStartTime: s ? s.defaultShiftStartTime : null,
        defaultShiftEndTime: s ? s.defaultShiftEndTime : null,
        graceMinutes: s ? s.graceMinutes : null,
      };
    });
  }
}
