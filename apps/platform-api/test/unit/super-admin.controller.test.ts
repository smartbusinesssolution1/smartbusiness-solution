import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { SuperAdminController } from "../../src/modules/super-admin/super-admin.controller.js";

interface MockResponse {
  statusCode: number;
  body: any;
  cookiesSet: Record<string, { value: string; options: any }>;
  cookiesCleared: string[];
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
  cookie: (name: string, value: string, opts: any) => MockResponse;
  clearCookie: (name: string) => MockResponse;
}

function createMockControllerReqRes(options: {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  superAdmin?: any;
} = {}) {
  const req = {
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    superAdmin: options.superAdmin,
  } as unknown as Request;

  const res: MockResponse = {
    statusCode: 200,
    body: null,
    cookiesSet: {},
    cookiesCleared: [],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    cookie(name: string, value: string, opts: any) {
      this.cookiesSet[name] = { value, options: opts };
      return this;
    },
    clearCookie(name: string) {
      this.cookiesCleared.push(name);
      return this;
    },
  };

  return { req, res: res as unknown as Response & MockResponse };
}

describe("Super Admin Controller Unit Tests", () => {
  const createMockService = () => ({
    login: vi.fn().mockResolvedValue({
      token: "mock_jwt_token_123",
      user: {
        id: "sa_001",
        name: "Super Admin",
        email: "admin@smartbusiness.us",
        role: "SUPER_ADMIN",
      },
    }),
    getDashboardOverview: vi.fn().mockResolvedValue({
      metrics: { activeTenants: 10 },
    }),
    getUsers: vi.fn().mockResolvedValue({
      items: [{ id: "u_1", fullName: "Test User" }],
      pagination: { total: 1 },
    }),
    unlockUser: vi.fn().mockResolvedValue({ success: true }),
    createOrganization: vi.fn().mockResolvedValue({
      id: "u_new",
      tenantName: "Apex Logistics",
    }),
    getPlans: vi.fn().mockResolvedValue([{ id: "plan_1", name: "Monthly" }]),
    createPlan: vi.fn().mockResolvedValue({ id: "plan_2", name: "Annual" }),
    updatePlan: vi.fn().mockResolvedValue({ id: "plan_1", price: 99 }),
    deletePlan: vi.fn().mockResolvedValue({ success: true }),
    getSubscriptions: vi.fn().mockResolvedValue({ items: [] }),
    updateSubscription: vi.fn().mockResolvedValue({ success: true }),
    syncStripe: vi.fn().mockResolvedValue({ success: true, syncedCount: 5 }),
    getTelemetryLogs: vi.fn().mockResolvedValue({ items: [] }),
    getTelemetryStats: vi.fn().mockResolvedValue({ totalErrors24h: 0 }),
  });

  describe("Authentication Handlers", () => {
    it("login sets super_admin_token cookie and returns user token", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes({
        body: { email: "admin@smartbusiness.us", password: "SuperAdmin@2026!" },
      });

      await controller.login(req, res);

      expect(service.login).toHaveBeenCalledWith(req.body);
      expect(res.cookiesSet["super_admin_token"]).toBeDefined();
      expect(res.cookiesSet["super_admin_token"]?.value).toBe("mock_jwt_token_123");
      expect(res.cookiesSet["super_admin_token"]?.options.httpOnly).toBe(true);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe("mock_jwt_token_123");
    });

    it("login catches authentication failure and responds with 401", async () => {
      const service = createMockService();
      service.login.mockRejectedValueOnce(new Error("Invalid administrative credentials."));
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes({
        body: { email: "admin@smartbusiness.us", password: "wrong" },
      });

      await controller.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Invalid administrative credentials.");
    });

    it("logout clears cookie and returns success response", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes();
      await controller.logout(req, res);

      expect(res.cookiesCleared).toContain("super_admin_token");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("me returns current session user attached to request", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const adminUser = { adminId: "sa_001", role: "SUPER_ADMIN" };
      const { req, res } = createMockControllerReqRes({ superAdmin: adminUser });

      await controller.me(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual(adminUser);
    });
  });

  describe("Operations Handlers", () => {
    it("getDashboard passes timeRange parameter", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes({ query: { timeRange: "quarter" } });
      await controller.getDashboard(req, res);

      expect(service.getDashboardOverview).toHaveBeenCalledWith("quarter");
      expect(res.statusCode).toBe(200);
    });

    it("unlockUser passes userId param and current admin ID", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes({
        params: { userId: "user_target_123" },
        superAdmin: { adminId: "sa_operating_001" },
      });

      await controller.unlockUser(req, res);

      expect(service.unlockUser).toHaveBeenCalledWith("user_target_123", "sa_operating_001");
      expect(res.statusCode).toBe(200);
    });

    it("createOrganization responds with 201 Created", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const payload = { tenantName: "Apex Logistics" };
      const { req, res } = createMockControllerReqRes({
        body: payload,
        superAdmin: { adminId: "sa_001" },
      });

      await controller.createOrganization(req, res);

      expect(service.createOrganization).toHaveBeenCalledWith(payload, "sa_001");
      expect(res.statusCode).toBe(201);
      expect(res.body.data.id).toBe("u_new");
    });

    it("createPlan responds with 201 Created", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const planPayload = { name: "Annual" };
      const { req, res } = createMockControllerReqRes({ body: planPayload });

      await controller.createPlan(req, res);

      expect(service.createPlan).toHaveBeenCalledWith(planPayload);
      expect(res.statusCode).toBe(201);
    });

    it("updatePlan and deletePlan execute successfully", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req: updateReq, res: updateRes } = createMockControllerReqRes({
        params: { id: "plan_1" },
        body: { price: 99 },
      });
      await controller.updatePlan(updateReq, updateRes);
      expect(service.updatePlan).toHaveBeenCalledWith("plan_1", { price: 99 });
      expect(updateRes.statusCode).toBe(200);

      const { req: delReq, res: delRes } = createMockControllerReqRes({
        params: { id: "plan_1" },
      });
      await controller.deletePlan(delReq, delRes);
      expect(service.deletePlan).toHaveBeenCalledWith("plan_1");
      expect(delRes.statusCode).toBe(200);
    });

    it("syncStripe calls service and returns 200", async () => {
      const service = createMockService();
      const controller = new SuperAdminController(service as any);

      const { req, res } = createMockControllerReqRes();
      await controller.syncStripe(req, res);

      expect(service.syncStripe).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    });
  });
});
