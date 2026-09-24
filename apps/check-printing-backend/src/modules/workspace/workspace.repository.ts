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

interface CreateMemberData {
  workspaceId: string;
  userId: string;
  isSuperUser: boolean;
  canCreate: boolean;
  canPrint: boolean;
  canApprove: boolean;
}

export type WorkspaceWithSettings = Workspace & {
  checkPrintingSettings: CheckPrintingSettings | null;
};

export interface MemberWithUser extends WorkspaceMember {
  user: Pick<User, "id" | "email" | "fullName" | "isActive" | "lastLoginAt">;
}

// ─── Repository ─────────────────────────────────────────

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

  // ─── Workspace CRUD ───────────────────────────────────

  async create(
    data: CreateWorkspaceData,
    creatorUserId: string,
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

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: creatorUserId,
          isSuperUser: true,
          canCreate: true,
          canPrint: true,
          canApprove: true,
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

  async findMembers(workspaceId: string): Promise<MemberWithUser[]> {
    return prisma.workspaceMember.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }) as Promise<MemberWithUser[]>;
  }

  async findMemberByUserId(
    workspaceId: string,
    userId: string,
  ): Promise<MemberWithUser | null> {
    return prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    }) as Promise<MemberWithUser | null>;
  }

  async findMemberById(
    memberId: string,
  ): Promise<(MemberWithUser & { workspace: Workspace }) | null> {
    return prisma.workspaceMember.findFirst({
      where: { id: memberId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        workspace: true,
      },
    }) as Promise<(MemberWithUser & { workspace: Workspace }) | null>;
  }

  async addMemberInTransaction(
    userData: {
      tenantId: string;
      email: string;
      fullName: string;
      passwordHash: string;
    } | null,
    memberData: CreateMemberData,
  ): Promise<MemberWithUser> {
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

      return tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: memberData.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: memberData.workspaceId,
          userId,
          isSuperUser: memberData.isSuperUser,
          canCreate: memberData.canCreate,
          canPrint: memberData.canPrint,
          canApprove: memberData.canApprove,
        },
        update: {
          isSuperUser: memberData.isSuperUser,
          canCreate: memberData.canCreate,
          canPrint: memberData.canPrint,
          canApprove: memberData.canApprove,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
        },
      }) as unknown as MemberWithUser;
    });
  }

  async updateMember(
    memberId: string,
    permissions: {
      isSuperUser?: boolean;
      canCreate?: boolean;
      canPrint?: boolean;
      canApprove?: boolean;
    },
  ): Promise<MemberWithUser> {
    return prisma.workspaceMember.update({
      where: { id: memberId },
      data: permissions,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    }) as Promise<MemberWithUser>;
  }

  async removeMember(memberId: string): Promise<void> {
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });
  }

  async countSuperUsers(workspaceId: string): Promise<number> {
    return prisma.workspaceMember.count({
      where: { workspaceId, isSuperUser: true, deletedAt: null },
    });
  }
}
