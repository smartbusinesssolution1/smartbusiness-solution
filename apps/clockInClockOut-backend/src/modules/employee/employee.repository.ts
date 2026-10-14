import { prisma } from "@smartbusiness/database";

export class EmployeeRepository {
  /**
   * Find employee attendance profile by User ID and Tenant ID
   */
  async findEmployeeByUserIdAndTenant(userId: string, tenantId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        workspaceMember: {
          userId,
          workspace: {
            tenantId,
          },
        },
      },
      include: {
        workspaceMember: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                isActive: true,
              },
            },
            workspace: {
              select: {
                id: true,
                businessName: true,
                tenantId: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all employees in a tenant workspace (for Admin/Manager directory, optionally filtered by workspaceId)
   */
  async findEmployeesByTenant(tenantId: string, workspaceId?: string) {
    return prisma.attendanceEmployeeDetails.findMany({
      where: {
        workspaceMember: {
          ...(workspaceId ? { workspaceId } : {}),
          workspace: {
            tenantId,
          },
        },
      },
      include: {
        workspaceMember: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                isActive: true,
              },
            },
            workspace: {
              select: {
                id: true,
                businessName: true,
              },
            },
          },
        },
      },
      orderBy: {
        employeeCode: "asc",
      },
    });
  }
}

