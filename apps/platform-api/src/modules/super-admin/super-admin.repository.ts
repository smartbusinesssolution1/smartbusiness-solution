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

  async getUsersWithTenants(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    service?: string;
    status?: string;
  } = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      tenantMembers: {
        some: {
          role: "OWNER",
        },
      },
    };

    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        {
          tenantMembers: {
            some: {
              tenant: {
                name: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    if (options.status && options.status !== "ALL") {
      if (options.status === "LOCKED") {
        where.lockedUntil = { gt: new Date() };
      } else if (options.status === "ACTIVE") {
        where.isActive = true;
      } else if (options.status === "SUSPENDED") {
        where.isActive = false;
      }
    }

    if (options.service && options.service !== "ALL") {
      const slugMatch =
        options.service === "CHECK_PRINTING"
          ? "check"
          : options.service === "CLOCK_IN_CLOCK_OUT"
            ? "clock"
            : "";
      if (slugMatch) {
        where.tenantMembers = {
          some: {
            role: "OWNER",
            tenant: {
              subscriptions: {
                some: {
                  product: {
                    slug: { contains: slugMatch },
                  },
                },
              },
            },
          },
        };
      }
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          tenantMembers: {
            where: {
              role: "OWNER",
            },
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
      }),
    ]);

    return {
      users,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
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

  async getSubscriptions(options: {
    page?: number;
    pageSize?: number;
    status?: string;
    service?: string;
  } = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductSubscriptionWhereInput = {};
    if (options.status && options.status !== "ALL") {
      where.status = options.status as any;
    }
    if (options.service && options.service !== "ALL") {
      if (options.service === "CHECK_PRINTING") {
        where.product = { slug: { contains: "check" } };
      } else if (options.service === "CLOCK_IN_CLOCK_OUT") {
        where.product = { slug: { contains: "clock" } };
      }
    }

    const [total, subscriptions] = await Promise.all([
      prisma.productSubscription.count({ where }),
      prisma.productSubscription.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          tenant: true,
          product: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      subscriptions,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getAuditLogs(options: {
    page?: number;
    pageSize?: number;
    limit?: number;
    search?: string;
    severity?: string;
    service?: string;
  } = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize || options.limit || 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { action: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      auditLogs,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
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
