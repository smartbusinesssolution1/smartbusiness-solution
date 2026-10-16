import {
  prisma,
  Prisma,
  type Workspace,
  type WorkspaceMember,
  type Tenant,
  type TenantMember,
  type User,
} from "@smartbusiness/database";
import { ROLES } from "../../shared/constants/rbac.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { unsatisfiableActiveRules } from "../approval-rule/rule-satisfiability.js";

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

export interface MemberWithRoles {
  id: string;
  userId: string;
  workspaceId: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: Pick<User, "id" | "email" | "fullName" | "isActive" | "lastLoginAt">;
  assignedRoles: Array<{
    role: {
      productId: string;
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
  ): Promise<Workspace> {
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
  ): Promise<Workspace | null> {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
    });
  }

  // Workspaces where the user holds at least one role in this product (a workspace they use
  // only through another product is not theirs here).
  async findUserWorkspaces(
    userId: string,
    tenantId: string,
    productId: string,
  ): Promise<Workspace[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        deletedAt: null,
        workspace: { tenantId, deletedAt: null },
        assignedRoles: { some: { role: { productId } } },
      },
      include: { workspace: true },
    });

    return memberships.map((m) => m.workspace);
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

    return prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
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

  // Members who hold at least one role in this product.
  async findMembers(workspaceId: string, productId: string): Promise<MemberWithRoles[]> {
    return prisma.workspaceMember.findMany({
      where: { workspaceId, deletedAt: null, assignedRoles: { some: { role: { productId } } } },
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

  // ─── Membership Changes ───────────────────────────────
  //
  // Every change to who is in a workspace, and to their Check Printing roles, runs in a
  // transaction that first locks the workspace row (SELECT ... FOR NO KEY UPDATE). Changes in one
  // workspace therefore happen one at a time, and the last-admin rule is checked against
  // committed data. Checked before the transaction instead, two admins demoting or removing
  // each other at the same moment would both see "two admins" and leave none.
  //
  // Only the acting product's roles are touched (role.productId). A member can also hold
  // roles in other products of the platform; those belong to those products.

  async addMemberInTransaction(
    userData: {
      tenantId: string;
      email: string;
      fullName: string;
      passwordHash: string;
    } | null,
    memberData: { workspaceId: string; userId: string },
    productId: string,
    roleIds: string[],
    assignedById: string,
  ): Promise<MemberWithRoles> {
    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, memberData.workspaceId);
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

      // A removed member's row is reactivated (it keeps the workspace's history together).
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

      // Replace, never append: roles left behind by an earlier removal must not come back.
      await tx.workspaceMemberRole.deleteMany({
        where: { workspaceMemberId: member.id, role: { productId } },
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
    }, TX_OPTIONS);
  }

  // Replaces the member's roles in this product. Returns the roles they had before (for the audit log).
  async setMemberRoles(
    memberId: string,
    workspaceId: string,
    productId: string,
    roles: Array<{ id: string; slug: string }>,
    assignedById: string,
  ): Promise<{ member: MemberWithRoles; previousRoleSlugs: string[] }> {
    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      await requireActiveMember(tx, memberId, workspaceId);
      const brokenBefore = await brokenRuleIds(tx, workspaceId);

      const previousRoleSlugs = await productRoleSlugs(tx, memberId, productId);
      const losesAdmin = previousRoleSlugs.includes(ROLES.ADMIN) && !roles.some((r) => r.slug === ROLES.ADMIN);
      if (losesAdmin && (await countActiveAdmins(tx, workspaceId)) <= 1) {
        throw new ValidationError("Cannot remove the last Admin. Promote another member first.", {
          roleSlugs: ["At least one Admin is required"],
        });
      }

      await tx.workspaceMemberRole.deleteMany({
        where: { workspaceMemberId: memberId, role: { productId } },
      });
      await tx.workspaceMemberRole.createMany({
        data: roles.map((role) => ({
          workspaceMemberId: memberId,
          roleId: role.id,
          assignedById,
        })),
      });

      await refuseIfRulesBroken(tx, workspaceId, brokenBefore, "changing these roles");

      const member = (await tx.workspaceMember.findUniqueOrThrow({
        where: { id: memberId },
        include: memberInclude,
      })) as unknown as MemberWithRoles;
      return { member, previousRoleSlugs };
    }, TX_OPTIONS);
  }

  // Removes the member from this product: their roles here are deleted. They leave the
  // workspace only if they hold no role in any product. Returns what was removed.
  async removeFromProduct(
    memberId: string,
    workspaceId: string,
    productId: string,
  ): Promise<{ removedRoleSlugs: string[]; leftWorkspace: boolean }> {
    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      await requireActiveMember(tx, memberId, workspaceId);
      const brokenBefore = await brokenRuleIds(tx, workspaceId);

      const removedRoleSlugs = await productRoleSlugs(tx, memberId, productId);
      if (removedRoleSlugs.includes(ROLES.ADMIN) && (await countActiveAdmins(tx, workspaceId)) <= 1) {
        throw new ValidationError("Cannot remove the last Admin. Promote another member first.", {
          member: ["At least one Admin is required"],
        });
      }

      await tx.workspaceMemberRole.deleteMany({
        where: { workspaceMemberId: memberId, role: { productId } },
      });

      const remainingRoles = await tx.workspaceMemberRole.count({ where: { workspaceMemberId: memberId } });
      const leftWorkspace = remainingRoles === 0;
      if (leftWorkspace) {
        await tx.workspaceMember.update({
          where: { id: memberId },
          data: { deletedAt: new Date() },
        });
      }

      await refuseIfRulesBroken(tx, workspaceId, brokenBefore, "removing this member");

      return { removedRoleSlugs, leftWorkspace };
    }, TX_OPTIONS);
  }
}

// ─── Transaction helpers ────────────────────────────────

type Tx = Prisma.TransactionClient;

// Prisma's defaults (2 s to get a connection, 5 s to finish) are short for a remote
// database when requests queue behind the workspace lock.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

// FOR NO KEY UPDATE: membership changes take turns, but unlike FOR UPDATE it does not block
// other transactions inserting rows that reference the workspace (checks, payees, audit entries).
async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM workspaces WHERE id = ${workspaceId} FOR NO KEY UPDATE`;
}

// The member may have been removed by a request that held the lock before us.
async function requireActiveMember(tx: Tx, memberId: string, workspaceId: string): Promise<void> {
  const member = await tx.workspaceMember.findFirst({
    where: { id: memberId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!member) throw new NotFoundError("Member");
}

// R-20: a member change must not leave an active approval rule unable to collect its
// approvals. Compared with the state before the change, so a rule that was already broken
// does not block unrelated changes. Throwing here rolls the whole change back.
async function brokenRuleIds(tx: Tx, workspaceId: string): Promise<Set<string>> {
  return new Set((await unsatisfiableActiveRules(tx, workspaceId)).map((r) => r.id));
}

async function refuseIfRulesBroken(tx: Tx, workspaceId: string, before: Set<string>, action: string): Promise<void> {
  const newlyBroken = (await unsatisfiableActiveRules(tx, workspaceId)).filter((r) => !before.has(r.id));
  if (newlyBroken.length === 0) return;
  const rules = newlyBroken
    .map((r) => `${r.label} (needs ${r.requiredApprovals}, would have ${r.available})`)
    .join("; ");
  throw new ConflictError(
    `Not done: ${action} would leave approval rule(s) without enough approvers: ${rules}. ` +
      "Checks matching them could never be approved. Add another approver or lower the required approvals first.",
  );
}

async function productRoleSlugs(tx: Tx, memberId: string, productId: string): Promise<string[]> {
  const rows = await tx.workspaceMemberRole.findMany({
    where: { workspaceMemberId: memberId, role: { productId } },
    select: { role: { select: { slug: true } } },
  });
  return rows.map((r) => r.role.slug);
}

async function countActiveAdmins(tx: Tx, workspaceId: string): Promise<number> {
  return tx.workspaceMemberRole.count({
    where: {
      workspaceMember: { workspaceId, deletedAt: null },
      role: { slug: ROLES.ADMIN },
    },
  });
}
