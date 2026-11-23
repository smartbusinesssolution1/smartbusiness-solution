import { describe, expect, it } from "vitest";
import {
  generateSuperAdminToken,
  verifySuperAdminToken,
} from "../../src/modules/super-admin/super-admin.guard.js";
import { SuperAdminService } from "../../src/modules/super-admin/super-admin.service.js";
import { PasswordService } from "@smartbusiness/auth";

describe("Super Admin Isolated Guard & Tokens", () => {
  it("generates and verifies SUPER_ADMIN session token", () => {
    const token = generateSuperAdminToken({
      adminId: "sa_001",
      email: "admin@smartbusiness.us",
      name: "Super Administrator",
      role: "SUPER_ADMIN",
    });

    const decoded = verifySuperAdminToken(token);
    expect(decoded.adminId).toBe("sa_001");
    expect(decoded.email).toBe("admin@smartbusiness.us");
    expect(decoded.role).toBe("SUPER_ADMIN");
    expect(decoded.type).toBe("SUPER_ADMIN_SESSION");
  });

  it("generates and verifies DEV_SUPER_ADMIN session token", () => {
    const token = generateSuperAdminToken({
      adminId: "dev_001",
      email: "dev@smartbusiness.us",
      name: "Dev Super Admin",
      role: "DEV_SUPER_ADMIN",
    });

    const decoded = verifySuperAdminToken(token);
    expect(decoded.adminId).toBe("dev_001");
    expect(decoded.email).toBe("dev@smartbusiness.us");
    expect(decoded.role).toBe("DEV_SUPER_ADMIN");
    expect(decoded.type).toBe("SUPER_ADMIN_SESSION");
  });

  it("fails verification for forged/tampered tokens", () => {
    expect(() => verifySuperAdminToken("invalid.token.here")).toThrow();
  });
});

describe("Super Admin Service Authentication & RBAC", () => {
  const mockRepo: any = {
    recordAudit: async () => {},
    getCounts: async () => ({
      activeTenants: 10,
      newTenantsThisMonth: 2,
      totalActiveUsers: 50,
      activeWorkspacesCount: 15,
      checksCountMtd: 120,
      checksVolumeMtdUsd: 45000,
      statesCoveredCount: 12,
    }),
    getProductSubscriptionsCount: async () => [],
    getRecentAuditActivity: async () => [],
    getUsersWithTenants: async () => [],
    getSubscriptions: async () => [],
    getAuditLogs: async () => [],
  };

  const service = new SuperAdminService(mockRepo, new PasswordService());

  it("authenticates standard Super Admin with SUPER_ADMIN role", async () => {
    const result = await service.login({
      email: "admin@smartbusiness.us",
      password: "SuperAdmin@2026!",
    });

    expect(result.user.role).toBe("SUPER_ADMIN");
    expect(result.token).toBeDefined();
    const verified = verifySuperAdminToken(result.token);
    expect(verified.role).toBe("SUPER_ADMIN");
  });

  it("authenticates Dev Super Admin with DEV_SUPER_ADMIN role", async () => {
    const result = await service.login({
      email: "dev@smartbusiness.us",
      password: "DevAdmin@2026!",
    });

    expect(result.user.role).toBe("DEV_SUPER_ADMIN");
    expect(result.token).toBeDefined();
    const verified = verifySuperAdminToken(result.token);
    expect(verified.role).toBe("DEV_SUPER_ADMIN");
  });

  it("refuses wrong password with error", async () => {
    await expect(
      service.login({
        email: "admin@smartbusiness.us",
        password: "IncorrectPassword!",
      })
    ).rejects.toThrow("Invalid administrative credentials.");
  });

  it("returns dashboard metrics structure", async () => {
    const dashboard = await service.getDashboardOverview();
    expect(dashboard.metrics.activeTenants).toBe(10);
    expect(dashboard.servicesHealth.length).toBeGreaterThan(0);
    expect(dashboard.productAdoption.length).toBe(3);
  });

  it("returns telemetry statistics", async () => {
    const stats = await service.getTelemetryStats();
    expect(stats.totalErrors24h).toBeDefined();
    expect(stats.p95LatencyMs).toBeDefined();
  });
});
