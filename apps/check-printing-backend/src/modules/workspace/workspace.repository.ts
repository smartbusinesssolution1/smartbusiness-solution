import { prisma, Prisma, Workspace, WorkspaceMember, Tenant, User } from "@smartbusiness/database";

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

export interface WorkspaceWithTenant extends Workspace {
  tenant: Tenant;
}

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

  // ─── User Operations ──────────────────────────────────

  async findUserByEmailInTenant(email: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, tenantId, deletedAt: null },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async createUserInTenant(data: {
    tenantId: string;
    email: string;
    fullName: string;
    passwordHash: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  }

  // ─── Workspace CRUD ───────────────────────────────────

  async create(data: CreateWorkspaceData, creatorUserId: string): Promise<Workspace> {
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
          isSuperUser: true,
          canCreate: true,
          canPrint: true,
          canApprove: true,
        },
      });

      return workspace;
    });
  }

  async findById(workspaceId: string, tenantId: string): Promise<Workspace | null> {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
    });
  }

  async findUserWorkspaces(userId: string, tenantId: string): Promise<Workspace[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
    });

    return memberships
      .map((m) => m.workspace)
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
    data: Partial<Omit<CreateWorkspaceData, "tenantId">> & {
      maxCheckAmount?: Prisma.Decimal | number;
      maxPastDays?: number;
      maxFutureDays?: number;
    },
  ): Promise<Workspace> {
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

    return prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
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
      where: { workspaceId },
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

  async findMemberByUserId(workspaceId: string, userId: string): Promise<MemberWithUser | null> {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
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
    }) as Promise<MemberWithUser | null>;
  }

  async findMemberById(memberId: string): Promise<(MemberWithUser & { workspace: Workspace }) | null> {
    return prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true, lastLoginAt: true },
        },
        workspace: true,
      },
    }) as Promise<(MemberWithUser & { workspace: Workspace }) | null>;
  }

  async addMemberInTransaction(
    userData: { tenantId: string; email: string; fullName: string; passwordHash: string } | null,
    memberData: CreateMemberData,
  ): Promise<MemberWithUser> {
    return prisma.$transaction(async (tx) => {
      let userId = memberData.userId;

      if (userData) {
        const user = await tx.user.create({ data: userData });
        userId = user.id;
      }

      return tx.workspaceMember.create({
        data: {
          workspaceId: memberData.workspaceId,
          userId,
          isSuperUser: memberData.isSuperUser,
          canCreate: memberData.canCreate,
          canPrint: memberData.canPrint,
          canApprove: memberData.canApprove,
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, isActive: true, lastLoginAt: true },
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
          select: { id: true, email: true, fullName: true, isActive: true, lastLoginAt: true },
        },
      },
    }) as Promise<MemberWithUser>;
  }

  async removeMember(memberId: string): Promise<void> {
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }

  async countSuperUsers(workspaceId: string): Promise<number> {
    return prisma.workspaceMember.count({
      where: { workspaceId, isSuperUser: true },
    });
  }
}
