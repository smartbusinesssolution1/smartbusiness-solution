import { prisma } from "@smartbusiness/database";

export class EmployeeRepository {
  /**
   * Find employee attendance profile by User ID and Tenant ID
   */
  async findEmployeeByUserIdAndTenant(userId: string, tenantId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        deletedAt: null,
        workspaceMember: {
          userId,
          workspace: {
            tenantId,
            deletedAt: null,
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
                createdAt: true,
              },
            },
            workspace: {
              select: {
                id: true,
                businessName: true,
                tenantId: true,
                addressLine1: true,
                city: true,
                state: true,
                attendanceSettings: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all workspaces assigned to a user within the specified tenant
   */
  async findAssignedWorkspaces(userId: string, tenantId: string) {
    return prisma.workspaceMember.findMany({
      where: {
        userId,
        deletedAt: null,
        workspace: {
          tenantId,
          deletedAt: null,
        },
      },
      include: {
        workspace: {
          include: {
            attendanceSettings: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /**
   * Atomically update user details (e.g. fullName) and employee details (e.g. phone, biometricPhotoUrl)
   */
  async updateProfileTransaction(params: {
    employeeId: string;
    userId: string;
    fullName?: string;
    phone?: string;
    biometricPhotoUrl?: string;
  }) {
    const { employeeId, userId, fullName, phone, biometricPhotoUrl } = params;

    return prisma.$transaction(async (tx) => {
      let updatedUser;
      if (fullName !== undefined) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: { fullName },
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        });
      }

      const employeeData: Record<string, any> = {
        updatedAt: new Date(),
      };
      if (phone !== undefined) {
        employeeData.phone = phone;
      }
      if (biometricPhotoUrl !== undefined) {
        employeeData.biometricPhotoUrl = biometricPhotoUrl;
      }

      const updatedEmployee = await tx.attendanceEmployeeDetails.update({
        where: { id: employeeId },
        data: employeeData,
      });

      return {
        employee: updatedEmployee,
        user: updatedUser,
      };
    });
  }

  /**
   * List all employees in a tenant workspace (for Admin/Manager directory, optionally filtered by workspaceId)
   */
  async findEmployeesByTenant(tenantId: string, workspaceId?: string) {
    return prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
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

  /**
   * Update employee profile (biometricPhotoUrl, phone) by employee detail ID
   */
  async updateEmployeeProfile(id: string, data: { biometricPhotoUrl?: string; phone?: string }) {
    return prisma.attendanceEmployeeDetails.update({
      where: { id },
      data: {
        ...(data.biometricPhotoUrl !== undefined ? { biometricPhotoUrl: data.biometricPhotoUrl } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        updatedAt: new Date(),
      },
    });
  }
}
