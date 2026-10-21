import { prisma, Prisma } from "@smartbusiness/database";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeListQueryInput,
} from "./admin-employee.schema.js";

export class AdminEmployeeRepository {
  /**
   * List employees within the tenant with multi-criteria filtering and pagination
   */
  async listEmployees(tenantId: string, query: EmployeeListQueryInput, callerUserId?: string) {
    const where: Prisma.AttendanceEmployeeDetailsWhereInput = {
      deletedAt: null,
      workspaceMember: {
        ...(callerUserId ? { userId: { not: callerUserId } } : {}),
        workspace: {
          tenantId,
          deletedAt: null,
          ...(query.workspaceId ? { id: query.workspaceId } : {}),
        },
      },
    };

    if (query.status && query.status !== "all") {
      where.isActive = query.status === "active";
    }

    if (query.role && query.role !== "all") {
      where.role = query.role;
    }

    if (query.department && query.department !== "all" && query.department.trim()) {
      where.department = {
        equals: query.department.trim(),
        mode: "insensitive",
      };
    }

    if (query.search) {
      const term = query.search;
      where.OR = [
        { employeeCode: { contains: term, mode: "insensitive" } },
        { designation: { contains: term, mode: "insensitive" } },
        { department: { contains: term, mode: "insensitive" } },
        {
          workspaceMember: {
            user: {
              OR: [
                { fullName: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await Promise.all([
      prisma.attendanceEmployeeDetails.findMany({
        where,
        include: {
          workspaceMember: {
            include: {
              user: true,
              workspace: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.attendanceEmployeeDetails.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * Find employee by ID scoped to tenant
   */
  async findEmployeeById(employeeId: string, tenantId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        workspaceMember: {
          workspace: {
            tenantId,
            deletedAt: null,
          },
        },
      },
      include: {
        workspaceMember: {
          include: {
            user: true,
            workspace: true,
          },
        },
      },
    });
  }

  /**
   * Check if an employeeCode is already in use by an active employee in tenant
   */
  async findEmployeeByCode(employeeCode: string, tenantId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        employeeCode: { equals: employeeCode, mode: "insensitive" },
        deletedAt: null,
        workspaceMember: {
          workspace: {
            tenantId,
          },
        },
      },
      select: { id: true, employeeCode: true },
    });
  }

  /**
   * Get all active employeeCodes in tenant/workspace to determine next sequential ID
   */
  async getExistingEmployeeCodes(tenantId: string, workspaceId?: string): Promise<string[]> {
    const records = await prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
        workspaceMember: {
          ...(workspaceId ? { workspaceId } : {}),
          workspace: {
            tenantId,
          },
        },
      },
      select: { employeeCode: true },
    });
    return records.map((r) => r.employeeCode);
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find workspace by ID scoped to tenant
   */
  async findWorkspace(workspaceId: string, tenantId: string) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null,
      },
    });
  }

  /**
   * Get default or first workspace in tenant if none specified
   */
  async getFirstWorkspace(tenantId: string) {
    return prisma.workspace.findFirst({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Count total active employees in tenant
   */
  async countTenantEmployees(tenantId: string) {
    return prisma.attendanceEmployeeDetails.count({
      where: {
        deletedAt: null,
        workspaceMember: {
          workspace: {
            tenantId,
          },
        },
      },
    });
  }

  /**
   * Atomic employee creation:
   * 1. User
   * 2. TenantMember
   * 3. WorkspaceMember
   * 4. AttendanceEmployeeDetails
   */
  async createEmployeeTransaction(params: {
    tenantId: string;
    workspaceId: string;
    input: CreateEmployeeInput;
    employeeCode: string;
    biometricPhotoUrl: string;
    passwordHash: string;
  }) {
    const { tenantId, workspaceId, input, employeeCode, biometricPhotoUrl, passwordHash } = params;

    return prisma.$transaction(async (tx) => {
      // 1. Find or create user
      let user = await tx.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: input.name,
            email: input.email,
            passwordHash,
            isActive: input.status === "active",
          },
        });
      } else {
        // Update user name/active
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: input.name,
            isActive: input.status === "active",
          },
        });
      }

      // 2. Tenant Member
      const tenantRole = input.role === "admin" ? "ADMIN" : "MEMBER";
      const existingMember = await tx.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        await tx.tenantMember.create({
          data: {
            tenantId,
            userId: user.id,
            role: tenantRole,
          },
        });
      } else if (existingMember.role !== "OWNER") {
        await tx.tenantMember.update({
          where: { id: existingMember.id },
          data: {
            role: tenantRole,
          },
        });
      }

      // 3. Workspace Member
      const workspaceMember = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          workspaceId,
          userId: user.id,
        },
      });

      // 4. Employee Attendance Details
      const employee = await tx.attendanceEmployeeDetails.upsert({
        where: {
          workspaceMemberId: workspaceMember.id,
        },
        update: {
          employeeCode,
          designation: input.designation,
          department: input.department,
          phone: input.phone,
          role: input.role,
          shiftType: input.shiftType,
          weeklySchedule: input.weeklySchedule ?? Prisma.JsonNull,
          biometricPhotoUrl,
          isActive: input.status === "active",
        },
        create: {
          workspaceMemberId: workspaceMember.id,
          employeeCode,
          designation: input.designation,
          department: input.department,
          phone: input.phone,
          role: input.role,
          shiftType: input.shiftType,
          weeklySchedule: input.weeklySchedule ?? Prisma.JsonNull,
          biometricPhotoUrl,
          isActive: input.status === "active",
        },
        include: {
          workspaceMember: {
            include: {
              user: true,
              workspace: true,
            },
          },
        },
      });

      return employee;
    });
  }

  /**
   * Atomic employee update
   */
  async updateEmployeeTransaction(params: {
    employeeId: string;
    tenantId: string;
    input: UpdateEmployeeInput;
    newAvatarUrl?: string;
  }) {
    const { employeeId, tenantId, input, newAvatarUrl } = params;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceEmployeeDetails.findFirst({
        where: {
          id: employeeId,
          workspaceMember: {
            workspace: {
              tenantId,
            },
          },
        },
        include: {
          workspaceMember: true,
        },
      });

      if (!existing) {
        return null;
      }

      // Update User if name or email changed
      if (input.name || input.email || input.status !== undefined) {
        await tx.user.update({
          where: { id: existing.workspaceMember.userId },
          data: {
            ...(input.name ? { fullName: input.name } : {}),
            ...(input.email ? { email: input.email } : {}),
            ...(input.status !== undefined ? { isActive: input.status === "active" } : {}),
          },
        });
      }

      // Update TenantMember role if role changed (never downgrade an OWNER)
      if (input.role) {
        const tenantRole = input.role === "admin" ? "ADMIN" : "MEMBER";
        await tx.tenantMember.updateMany({
          where: {
            tenantId,
            userId: existing.workspaceMember.userId,
            role: { not: "OWNER" },
          },
          data: {
            role: tenantRole,
          },
        });
      }

      // Update AttendanceEmployeeDetails
      const updateData: Prisma.AttendanceEmployeeDetailsUpdateInput = {};
      if (input.employeeId !== undefined) updateData.employeeCode = input.employeeId;
      if (input.designation !== undefined) updateData.designation = input.designation;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.shiftType !== undefined) updateData.shiftType = input.shiftType;
      if (input.weeklySchedule !== undefined) {
        updateData.weeklySchedule = input.weeklySchedule ?? Prisma.JsonNull;
      }
      if (input.status !== undefined) updateData.isActive = input.status === "active";
      if (newAvatarUrl) updateData.biometricPhotoUrl = newAvatarUrl;

      const updated = await tx.attendanceEmployeeDetails.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          workspaceMember: {
            include: {
              user: true,
              workspace: true,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Soft delete employee record:
   * Sets deletedAt and deactivates employee while preserving all attendance history intact.
   */
  async deleteEmployee(employeeId: string, tenantId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceEmployeeDetails.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          workspaceMember: {
            workspace: {
              tenantId,
            },
          },
        },
      });

      if (!existing) {
        return null;
      }

      // Soft delete: sets deletedAt timestamp and deactivates, keeping attendance records 100% intact!
      await tx.attendanceEmployeeDetails.update({
        where: { id: employeeId },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      return true;
    });
  }
}
