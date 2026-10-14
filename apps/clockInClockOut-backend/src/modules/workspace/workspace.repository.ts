import { prisma } from "@smartbusiness/database";

export class WorkspaceRepository {
  /**
   * Find all active workspaces belonging to a tenant, including geofence settings and staff count.
   */
  async findWorkspacesByTenant(tenantId: string) {
    return prisma.workspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        attendanceSettings: {
          select: {
            latitude: true,
            longitude: true,
            radiusMeters: true,
            graceMinutes: true,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /**
   * Find a specific active workspace by ID within a tenant.
   */
  async findWorkspaceById(workspaceId: string, tenantId: string) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null,
      },
      include: {
        attendanceSettings: {
          select: {
            latitude: true,
            longitude: true,
            radiusMeters: true,
            graceMinutes: true,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });
  }
}
