import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, seedProducts } from "../helpers/db.js";
import { getApp } from "../helpers/auth-client.js";

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
});

describe("Super Admin Authentication & Role-Based Access Control", () => {
  it("authenticates standard Super Admin and receives SUPER_ADMIN role", async () => {
    const res = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "admin@smartbusiness.us",
        password: "SuperAdmin@2026!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("SUPER_ADMIN");
    expect(res.body.data.token).toBeDefined();
  });

  it("authenticates Dev Super Admin and receives DEV_SUPER_ADMIN role", async () => {
    const res = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "dev@smartbusiness.us",
        password: "DevAdmin@2026!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("DEV_SUPER_ADMIN");
    expect(res.body.data.token).toBeDefined();
  });

  it("refuses invalid super admin credentials with 401", async () => {
    const res = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "admin@smartbusiness.us",
        password: "WrongPassword123!",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("refuses unauthenticated requests to protected endpoints with 401", async () => {
    const res = await request(getApp()).get("/api/v1/super-admin/dashboard");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("allows standard Super Admin to access dashboard overview", async () => {
    const login = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "admin@smartbusiness.us",
        password: "SuperAdmin@2026!",
      });
    const token = login.body.data.token;

    const res = await request(getApp())
      .get("/api/v1/super-admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.productAdoption).toBeDefined();
    expect(res.body.data.servicesHealth).toBeDefined();
  });

  it("refuses standard Super Admin from accessing telemetry logs with 403 Forbidden", async () => {
    const login = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "admin@smartbusiness.us",
        password: "SuperAdmin@2026!",
      });
    const token = login.body.data.token;

    const res = await request(getApp())
      .get("/api/v1/super-admin/telemetry/logs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("restricted to Dev Super Admin");
  });

  it("allows Dev Super Admin to access telemetry logs with 200 OK", async () => {
    const login = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "dev@smartbusiness.us",
        password: "DevAdmin@2026!",
      });
    const token = login.body.data.token;

    const res = await request(getApp())
      .get("/api/v1/super-admin/telemetry/logs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("creates an organization atomically and returns owner record", async () => {
    const login = await request(getApp())
      .post("/api/v1/super-admin/auth/login")
      .send({
        email: "admin@smartbusiness.us",
        password: "SuperAdmin@2026!",
      });
    const token = login.body.data.token;

    const res = await request(getApp())
      .post("/api/v1/super-admin/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantName: "Apex Logistics Corp",
        billingEmail: "billing@apexlogistics.test",
        fullName: "Marcus Vance",
        email: "marcus@apexlogistics.test",
        city: "Austin",
        state: "TX",
        workspaceName: "Apex Austin Yard",
        serviceType: "BOTH",
        planName: "Enterprise All-Access Bundle",
        planPrice: 299,
        planDuration: "Monthly (1 Month)",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantName).toBe("Apex Logistics Corp");
    expect(res.body.data.email).toBe("marcus@apexlogistics.test");
    expect(res.body.data.workspacesCount).toBe(1);
    expect(res.body.data.workspaces[0].businessName).toBe("Apex Austin Yard");
  });
});
