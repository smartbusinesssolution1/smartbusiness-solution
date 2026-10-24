import { prisma } from "@smartbusiness/database";
import type { UpdateGeofenceInput } from "./admin-geofence.schema.js";

export class AdminGeofenceRepository {
  /**
   * Find workspace by ID scoped to tenant (ensuring cross-tenant isolation),
   * including parent corporate Tenant metadata.
   */
  async findWorkspaceById(workspaceId: string, tenantId: string) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        attendanceSettings: true,
      },
    });
  }

  /**
   * List all workspaces in tenant with parent corporate Tenant metadata and attendance settings
   */
  async listTenantWorkspacesWithGeofence(tenantId: string) {
    return prisma.workspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        attendanceSettings: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /**
   * Upsert geofence / attendance settings for a workspace
   */
  async upsertGeofence(workspaceId: string, data: UpdateGeofenceInput) {
    return prisma.attendanceSettings.upsert({
      where: { workspaceId },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radiusMeters,
        graceMinutes: data.graceMinutes,
        defaultShiftStartTime: data.defaultShiftStartTime,
        defaultShiftEndTime: data.defaultShiftEndTime,
      },
      create: {
        workspaceId,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radiusMeters,
        graceMinutes: data.graceMinutes,
        defaultShiftStartTime: data.defaultShiftStartTime,
        defaultShiftEndTime: data.defaultShiftEndTime,
      },
    });
  }

  /**
   * Update tenant organization name
   */
  async updateTenantName(tenantId: string, name: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { name },
    });
  }

  /**
   * Update workspace / campus business name
   */
  async updateWorkspaceName(workspaceId: string, tenantId: string, businessName: string) {
    return prisma.workspace.update({
      where: { id: workspaceId, tenantId },
      data: { businessName },
    });
  }
}
