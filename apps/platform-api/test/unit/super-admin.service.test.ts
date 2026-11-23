import { describe, expect, it, vi } from "vitest";
import { SuperAdminService } from "../../src/modules/super-admin/super-admin.service.js";
import { PasswordService } from "@smartbusiness/auth";

describe("Super Admin Service Comprehensive Unit Tests", () => {
  const createMockRepo = () => ({
    getCounts: vi.fn().mockResolvedValue({
      activeTenants: 15,
      newTenantsThisMonth: 4,
      totalActiveUsers: 60,
      activeWorkspacesCount: 20,
      checksCountMtd: 150,
      checksVolumeMtdUsd: 55000,
      statesCoveredCount: 14,
    }),
    getProductSubscriptionsCount: vi.fn().mockResolvedValue([
      { product: { slug: "check-printing" } },
      { product: { slug: "clock-in-clock-out" } },
    ]),
    getRecentAuditActivity: vi.fn().mockResolvedValue([
      {
        id: "audit_001",
        tenantId: "t_001",
        action: "CHECK_BATCH_PRINTED",
        entityType: "PrintBatch",
        entityId: "batch_12345678",
        createdAt: new Date("2026-11-01T12:00:00Z"),
        detailsJson: { tenantName: "Apex Logistics" },
      },
      {
        id: "audit_002",
        tenantId: "t_002",
        action: "ORGANIZATION_CREATED",
        entityType: "Tenant",
        entityId: "tenant_87654321",
        createdAt: new Date("2026-11-02T14:00:00Z"),
        detailsJson: { tenantName: "Sunshine Pools" },
      },
    ]),
    getUsersWithTenants: vi.fn().mockResolvedValue({
      users: [
        {
          id: "u_active",
          fullName: "Maria Santos",
          email: "maria@greenacres.test",
          isActive: true,
          lockedUntil: null,
          failedLoginCount: 0,
          tenantMembers: [
            {
              role: "OWNER",
              tenant: {
                id: "t_greenacres",
                name: "Green Acres Landscaping",
                workspaces: [
                  {
                    id: "ws_01",
                    businessName: "Green Acres Yard",
                    city: "Austin",
                    state: "TX",
                    _count: { bankAccounts: 2 },
                  },
                ],
                subscriptions: [
                  { product: { slug: "check-printing" } },
                  { product: { slug: "clock-in-clock-out" } },
                ],
              },
            },
          ],
        },
        {
          id: "u_locked",
          fullName: "Locked Operator",
          email: "locked@test.com",
          isActive: true,
          lockedUntil: new Date(Date.now() + 1000 * 60 * 60), // locked for 1hr
          failedLoginCount: 5,
          tenantMembers: [],
        },
        {
          id: "u_suspended",
          fullName: "Inactive Member",
          email: "inactive@test.com",
          isActive: false,
          lockedUntil: null,
          failedLoginCount: 0,
          tenantMembers: [],
        },
      ],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
    findUserById: vi.fn().mockImplementation(async (id: string) => {
      if (id === "u_locked") {
        return {
          id: "u_locked",
          email: "locked@test.com",
          tenantMembers: [{ tenantId: "t_001" }],
        };
      }
      return null;
    }),
    unlockUser: vi.fn().mockResolvedValue(undefined),
    recordAudit: vi.fn().mockResolvedValue(undefined),
    createOrganization: vi.fn().mockResolvedValue({
      tenant: { id: "t_new", name: "New Enterprise Corp" },
      user: { id: "u_new", fullName: "Jane Doe", email: "jane@newent.test" },
      workspace: {
        id: "ws_new",
        businessName: "New HQ",
        addressLine1: "100 Main St",
        city: "Dallas",
        state: "TX",
        zipCode: "75001",
      },
    }),
    getSubscriptions: vi.fn().mockResolvedValue({
      subscriptions: [
        {
          id: "sub_01",
          tenantId: "t_001",
          plan: "BUSINESS",
          status: "ACTIVE",
          currentPeriodEndsAt: new Date("2026-12-01"),
          tenant: { name: "Apex Logistics", billingEmail: "billing@apex.test" },
          product: { name: "Check Printing", slug: "check-printing" },
        },
        {
          id: "sub_02",
          tenantId: "t_002",
          plan: "PROFESSIONAL",
          status: "ACTIVE",
          currentPeriodEndsAt: new Date("2026-12-01"),
          tenant: { name: "Sunshine Pool", billingEmail: "billing@sunshine.test" },
          product: { name: "Attendance & Face AI", slug: "clock-in-clock-out" },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
    getAuditLogs: vi.fn().mockResolvedValue({
      auditLogs: [
        {
          id: "log-uuid-1234",
          createdAt: new Date("2026-11-03T10:00:00Z"),
          action: "PAYMENT_FAILED",
          entityType: "Subscription",
          entityId: "sub_123",
          tenantId: "t_001",
          userId: "u_001",
          detailsJson: { reason: "Insufficient funds" },
        },
        {
          id: "log-uuid-5678",
          createdAt: new Date("2026-11-03T11:00:00Z"),
          action: "TOKEN_ROTATION_WARN",
          entityType: "UserToken",
          entityId: "tok_456",
          detailsJson: {},
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
  });

  const passwordService = new PasswordService();

  describe("Administrative Authentication", () => {
    it("logs in standard super admin with case-insensitive email", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const res = await service.login({
        email: "ADMIN@SmartBusiness.us",
        password: "SuperAdmin@2026!",
      });

      expect(res.user.role).toBe("SUPER_ADMIN");
      expect(res.user.email).toBe("admin@smartbusiness.us");
      expect(res.token).toBeDefined();
    });

    it("logs in Dev Super Admin with root alias email", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const res = await service.login({
        email: "root@smartbusiness.us",
        password: "DevAdmin@2026!",
      });

      expect(res.user.role).toBe("DEV_SUPER_ADMIN");
      expect(res.token).toBeDefined();
    });

    it("throws error when password is wrong", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      await expect(
        service.login({
          email: "admin@smartbusiness.us",
          password: "WrongPassword!",
        })
      ).rejects.toThrow("Invalid administrative credentials.");
    });
  });

  describe("Dashboard & Metrics", () => {
    it("computes dashboard metrics and adoption breakdown", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const data = await service.getDashboardOverview("30d");

      expect(data.metrics.activeTenants).toBeGreaterThan(0);
      expect(data.servicesHealth.length).toBe(4); // Platform API, Check Printing, ClockIn, Face Rec
      expect(data.recentActivity.length).toBe(2);
      expect(data.recentActivity[0]?.badgeType).toBe("CHECK_BATCH");
      expect(data.recentActivity[1]?.badgeType).toBe("UPGRADE");
    });

    it("scales revenue and counts when quarter range is requested", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const dataQuarter = await service.getDashboardOverview("quarter");
      expect(dataQuarter.revenueTrend.length).toBeGreaterThan(0);
      expect(dataQuarter.metrics.mrrGrowthMoM).toBe(38.4);
    });
  });

  describe("User Management & Unlock", () => {
    it("maps raw users and derives ACTIVE, LOCKED, and SUSPENDED statuses", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const result = await service.getUsers();
      expect(result.items.length).toBe(3);

      const activeUser = result.items.find((u) => u.id === "u_active");
      expect(activeUser?.status).toBe("ACTIVE");
      expect(activeUser?.serviceType).toBe("BOTH");
      expect(activeUser?.workspaces[0].bankAccountsCount).toBe(2);

      const lockedUser = result.items.find((u) => u.id === "u_locked");
      expect(lockedUser?.status).toBe("LOCKED");

      const suspendedUser = result.items.find((u) => u.id === "u_suspended");
      expect(suspendedUser?.status).toBe("SUSPENDED");
    });

    it("unlocks locked user and writes audit log", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const res = await service.unlockUser("u_locked", "sa_001");
      expect(res.success).toBe(true);
      expect(repo.unlockUser).toHaveBeenCalledWith("u_locked");
      expect(repo.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_UNLOCKED_BY_SUPER_ADMIN",
          entityId: "u_locked",
        })
      );
    });

    it("throws error when unlocking unknown user", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      await expect(service.unlockUser("u_nonexistent")).rejects.toThrow("User not found.");
    });
  });

  describe("Organization Creation", () => {
    it("hashes password and delegates to repository atomic creation", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const res = await service.createOrganization({
        tenantName: "New Enterprise Corp",
        billingEmail: "billing@newent.test",
        fullName: "Jane Doe",
        email: "jane@newent.test",
        city: "Dallas",
        state: "TX",
        workspaceName: "New HQ",
        serviceType: "BOTH",
        planName: "Enterprise All-Access Bundle",
        planPrice: 299,
        planDuration: "Monthly (1 Month)",
      });

      expect(res.id).toBe("u_new");
      expect(res.tenantName).toBe("New Enterprise Corp");
      expect(res.workspacesCount).toBe(1);
      expect(repo.createOrganization).toHaveBeenCalledOnce();
    });
  });

  describe("Plans Lifecycle Management", () => {
    it("returns active plans list", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const plans = await service.getPlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);
    });

    it("creates, updates, and deletes plans", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      // Create
      const created = await service.createPlan({
        name: "Test Dynamic Tier",
        service: "CHECK_PRINTING",
        durationCount: 3,
        durationUnit: "MONTH",
        price: 120,
        status: "ACTIVE",
        description: "Test quarterly package",
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe("Test Dynamic Tier");

      // Update
      const updated = await service.updatePlan(created.id, {
        price: 135,
        status: "INACTIVE",
      });
      expect(updated.price).toBe(135);
      expect(updated.status).toBe("INACTIVE");

      // Delete
      const deleted = await service.deletePlan(created.id);
      expect(deleted.success).toBe(true);

      const plansAfter = await service.getPlans();
      expect(plansAfter.find((p) => p.id === created.id)).toBeUndefined();
    });

    it("throws error when updating nonexistent plan", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      await expect(
        service.updatePlan("plan_invalid_999", { name: "Nonexistent" })
      ).rejects.toThrow("Plan with ID plan_invalid_999 not found.");
    });
  });

  describe("Subscriptions & Stripe Sync", () => {
    it("maps subscriptions and calculates pricing tiers", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const subs = await service.getSubscriptions();
      expect(subs.items.length).toBe(2);
      expect(subs.items[0]?.amount).toBe(299); // BUSINESS plan
      expect(subs.items[1]?.amount).toBe(79);  // PROFESSIONAL plan
    });

    it("syncs Stripe and returns total active count", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const res = await service.syncStripe();
      expect(res.success).toBe(true);
      expect(res.syncedCount).toBe(2);
    });
  });

  describe("Telemetry Logs & Stats", () => {
    it("maps audit logs to telemetry events with trace IDs and severity levels", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const logs = await service.getTelemetryLogs();
      expect(logs.items.length).toBe(2);

      expect(logs.items[0]?.severity).toBe("ERROR"); // PAYMENT_FAILED
      expect(logs.items[0]?.traceId).toMatch(/^tr_/);

      expect(logs.items[1]?.severity).toBe("WARN");  // TOKEN_ROTATION_WARN
    });

    it("returns telemetry summary metrics", async () => {
      const repo = createMockRepo();
      const service = new SuperAdminService(repo as any, passwordService);

      const stats = await service.getTelemetryStats();
      expect(stats.totalErrors24h).toBe(3);
      expect(stats.p95LatencyMs).toBe(24);
      expect(stats.errorRatePercent).toBe(0.02);
    });
  });
});
