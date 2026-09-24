import {
  prisma,
  Prisma,
  type Workspace,
  type WorkspaceMember,
  type Tenant,
  type TenantMember,
  type User,
  type CheckPrintingSettings,
} from "@smartbusiness/database";
import { ROLES } from "../../shared/constants/rbac.js";

// ─── Types ──────────────────────────────────────────────

interface CreateWorkspaceData {
  tenantId: string;
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
}

export type WorkspaceWithSettings = Workspace & {
  checkPrintingSettings: CheckPrintingSettings | null;
};

export interface MemberWithRoles {
  id: string;
  userId: string;
  workspaceId: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: Pick<User, "id" | "email" | "fullName" | "isActive" | "lastLoginAt">;
  assignedRoles: Array<{
    role: {
      slug: string;
      name: string;
      rolePermissions: Array<{
        permission: {
          action: string;
        };
      }>;
    };
  }>;
}

// ─── Repository ─────────────────────────────────────────

const memberInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      lastLoginAt: true,
    },
  },
  assignedRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} as const;

export class WorkspaceRepository {
  // ─── Tenant Operations ────────────────────────────────

  async findTenantById(tenantId: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });
  }

  async findTenantMembership(
    tenantId: string,
    userId: string,
  ): Promise<TenantMember | null> {
    return prisma.tenantMember.findFirst({
      where: { tenantId, userId, deletedAt: null },
    });
  }

  // ─── User Operations ──────────────────────────────────

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  // ─── Role Operations ──────────────────────────────────

  async findRolesByProductAndSlugs(
    productId: string,
    slugs: string[],
  ) {
    return prisma.role.findMany({
      where: {
        productId,
        slug: { in: slugs },
      },
    });
  }

  // ─── Workspace CRUD ───────────────────────────────────

  async create(
    data: CreateWorkspaceData,
    creatorUserId: string,
    productId: string,
  ): Promise<WorkspaceWithSettings> {
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
        include: { checkPrintingSettings: true },
      });

      const adminRole = await tx.role.findUnique({
        where: {
          productId_slug: { productId, slug: ROLES.ADMIN },
        },
      });

      if (!adminRole) {
        throw new Error("System role check-admin not found. Run RBAC seed first.");
      }

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: creatorUserId,
        },
      });

      await tx.workspaceMemberRole.create({
        data: {
          workspaceMemberId: member.id,
          roleId: adminRole.id,
          assignedById: creatorUserId,
        },
      });

      return workspace;
    });
  }

  async findById(
    workspaceId: string,
    tenantId: string,
  ): Promise<WorkspaceWithSettings | null> {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      include: { checkPrintingSettings: true },
    }) as Promise<WorkspaceWithSettings | null>;
  }

  async findUserWorkspaces(
    userId: string,
    tenantId: string,
  ): Promise<WorkspaceWithSettings[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId, deletedAt: null },
      include: {
        workspace: {
          include: { checkPrintingSettings: true },
        },
      },
    });

    return memberships
      .map((m) => m.workspace as WorkspaceWithSettings)
      .filter((w) => w.tenantId === tenantId && w.deletedAt === null);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return prisma.workspace.count({
      where: { tenantId, deletedAt: null },
    });
  }

  async update(
    workspaceId: string,
    tenantId: string,
    data: Partial<Omit<CreateWorkspaceData, "tenantId">>,
  ): Promise<WorkspaceWithSettings> {
    const cleanData: Record<string, unknown> = { ...data };
    if (data.addressLine2 === "") cleanData.addressLine2 = null;
    if (data.phone === "") cleanData.phone = null;

    const rows = await prisma.workspace.updateMany({
      where: { id: workspaceId, tenantId, deletedAt: null },
      data: cleanData,
    });

    if (rows.count === 0) {
      throw new Error("Workspace not found or already deleted");
    }

    return prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { checkPrintingSettings: true },
    }) as Promise<WorkspaceWithSettings>;
  }

  async softDelete(workspaceId: string, tenantId: string): Promise<void> {
    const rows = await prisma.workspace.updateMany({
      where: { id: workspaceId, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (rows.count === 0) {
      throw new Error("Workspace not found or already deleted");
    }
  }

  // ─── Member Management ────────────────────────────────

  async findMembers(workspaceId: string): Promise<MemberWithRoles[]> {
    return prisma.workspaceMember.findMany({
      where: { workspaceId, deletedAt: null },
      include: memberInclude,
      orderBy: { createdAt: "asc" },
    }) as unknown as Promise<MemberWithRoles[]>;
  }

  async findMemberByUserId(
    workspaceId: string,
    userId: string,
  ): Promise<MemberWithRoles | null> {
    return prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      include: memberInclude,
    }) as unknown as Promise<MemberWithRoles | null>;
  }

  async findMemberById(
    memberId: string,
  ): Promise<(MemberWithRoles & { workspace: Workspace }) | null> {
    return prisma.workspaceMember.findFirst({
      where: { id: memberId, deletedAt: null },
      include: {
        ...memberInclude,
        workspace: true,
      },
    }) as unknown as Promise<(MemberWithRoles & { workspace: Workspace }) | null>;
  }

  async addMemberInTransaction(
    userData: {
      tenantId: string;
      email: string;
      fullName: string;
      passwordHash: string;
    } | null,
    memberData: { workspaceId: string; userId: string },
    roleIds: string[],
    assignedById: string,
  ): Promise<MemberWithRoles> {
    return prisma.$transaction(async (tx) => {
      let userId = memberData.userId;

      if (userData) {
        const user = await tx.user.create({
          data: {
            email: userData.email,
            fullName: userData.fullName,
            passwordHash: userData.passwordHash,
          },
        });
        userId = user.id;

        await tx.tenantMember.create({
          data: {
            tenantId: userData.tenantId,
            userId: user.id,
            role: "MEMBER",
          },
        });
      }

      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: memberData.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: memberData.workspaceId,
          userId,
        },
        update: {
          deletedAt: null,
        },
      });

      await tx.workspaceMemberRole.createMany({
        data: roleIds.map((roleId) => ({
          workspaceMemberId: member.id,
          roleId,
          assignedById,
        })),
      });

      return tx.workspaceMember.findUniqueOrThrow({
        where: { id: member.id },
        include: memberInclude,
      }) as unknown as MemberWithRoles;
    });
  }

  async setMemberRoles(
    memberId: string,
    roleIds: string[],
    assignedById: string,
  ): Promise<MemberWithRoles> {
    return prisma.$transaction(async (tx) => {
      await tx.workspaceMemberRole.deleteMany({
        where: { workspaceMemberId: memberId },
      });

      await tx.workspaceMemberRole.createMany({
        data: roleIds.map((roleId) => ({
          workspaceMemberId: memberId,
          roleId,
          assignedById,
        })),
      });

      return tx.workspaceMember.findUniqueOrThrow({
        where: { id: memberId },
        include: memberInclude,
      }) as unknown as MemberWithRoles;
    });
  }

  async removeMember(memberId: string): Promise<void> {
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });
  }

  async countAdmins(workspaceId: string): Promise<number> {
    return prisma.workspaceMemberRole.count({
      where: {
        workspaceMember: {
          workspaceId,
          deletedAt: null,
        },
        role: {
          slug: ROLES.ADMIN,
        },
      },
    });
  }

  async memberHasRole(memberId: string, roleSlug: string): Promise<boolean> {
    const count = await prisma.workspaceMemberRole.count({
      where: {
        workspaceMemberId: memberId,
        role: { slug: roleSlug },
      },
    });
    return count > 0;
  }
}
