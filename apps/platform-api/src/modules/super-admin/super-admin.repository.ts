import { prisma, type Prisma } from "@smartbusiness/database";
import type { CreateOrganizationInput } from "./super-admin.schema.js";

export class SuperAdminRepository {
  async getCounts() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      activeTenants,
      newTenantsThisMonth,
      totalActiveUsers,
      activeWorkspacesCount,
      checksCountMtd,
      checksVolumeAggregate,
      workspacesWithState,
    ] = await Promise.all([
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.workspace.count(),
      prisma.check.count({ where: { createdAt: { gte: startOfMonth } } }).catch(() => 0),
      prisma.check.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: startOfMonth } },
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.workspace.findMany({
        select: { state: true },
        distinct: ["state"],
      }),
    ]);

    const statesCoveredCount = workspacesWithState.filter((w) => Boolean(w.state)).length;
    const checksVolumeMtdUsd = Number(checksVolumeAggregate?._sum?.amount ?? 0);

    return {
      activeTenants,
      newTenantsThisMonth,
      totalActiveUsers,
      activeWorkspacesCount,
      checksCountMtd,
      checksVolumeMtdUsd,
      statesCoveredCount,
    };
  }

  async getProductSubscriptionsCount() {
    return prisma.productSubscription.findMany({
      include: {
        product: true,
      },
      where: {
        status: { in: ["ACTIVE", "TRIALING"] },
      },
    });
  }

  async getRecentAuditActivity(limit: number = 10) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async getUsersWithTenants() {
    return prisma.user.findMany({
      include: {
        tenantMembers: {
          include: {
            tenant: {
              include: {
                workspaces: {
                  include: {
                    _count: {
                      select: { bankAccounts: true },
                    },
                  },
                },
                subscriptions: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantMembers: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  async unlockUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  async createOrganization(payload: CreateOrganizationInput, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: payload.tenantName,
          billingEmail: payload.billingEmail,
          status: "ACTIVE",
        },
      });

      // 2. Create User or find existing
      let user = await tx.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: payload.email,
            fullName: payload.fullName,
            passwordHash,
            isActive: true,
          },
        });
      }

      // 3. Create TenantMember as OWNER
      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // 4. Create primary Workspace
      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          businessName: payload.workspaceName || `${payload.tenantName} HQ`,
          addressLine1: payload.workspaceAddress || "100 Main St",
          city: payload.city,
          state: payload.state.slice(0, 2).toUpperCase(),
          zipCode: (payload.zipCode || "10001").slice(0, 10),
        },
      });

      // 5. Connect product subscriptions
      const targetSlugs =
        payload.serviceType === "BOTH"
          ? ["check-printing", "clock-in-clock-out"]
          : payload.serviceType === "CLOCK_IN_CLOCK_OUT"
            ? ["clock-in-clock-out"]
            : ["check-printing"];

      const products = await tx.product.findMany({
        where: { slug: { in: targetSlugs } },
      });

      for (const product of products) {
        await tx.productSubscription.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            plan: "PROFESSIONAL",
            status: "ACTIVE",
            currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: "ORGANIZATION_CREATED_BY_SUPER_ADMIN",
          entityType: "Tenant",
          entityId: tenant.id,
          detailsJson: {
            tenantName: payload.tenantName,
            planName: payload.planName,
            serviceType: payload.serviceType,
          },
        },
      });

      return {
        tenant,
        user,
        workspace,
      };
    });
  }

  async getSubscriptions() {
    return prisma.productSubscription.findMany({
      include: {
        tenant: true,
        product: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getAuditLogs(options: {
    limit?: number;
    search?: string;
  } = {}) {
    const { limit = 50, search } = options;

    const where: Prisma.AuditLogWhereInput = {};
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
      ];
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async recordAudit(data: {
    tenantId?: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    detailsJson?: Record<string, unknown>;
  }) {
    if (!data.tenantId || !data.userId) {
      // AuditLog in database requires tenantId and userId foreign keys
      return;
    }

    try {
      await prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          detailsJson: (data.detailsJson ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Non-blocking audit log
    }
  }
}
