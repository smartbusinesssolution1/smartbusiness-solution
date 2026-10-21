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

  /**
   * Create a new workspace under a tenant and register the creator as a workspace member.
   */
  async createWorkspace(
    data: {
      tenantId: string;
      businessName: string;
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      state: string;
      zipCode: string;
      phone?: string | null;
    },
    creatorUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          tenantId: data.tenantId,
          businessName: data.businessName,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          phone: data.phone || null,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: creatorUserId,
        },
      });

      return tx.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
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
    });
  }
}
