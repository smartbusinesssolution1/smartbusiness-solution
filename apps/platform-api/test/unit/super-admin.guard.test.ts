import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  generateSuperAdminToken,
  verifySuperAdminToken,
  extractSuperAdminToken,
  requireSuperAdmin,
  requireDevSuperAdmin,
} from "../../src/modules/super-admin/super-admin.guard.js";

interface MockGuardResponse {
  statusCode: number;
  body: any;
  status: (code: number) => MockGuardResponse;
  json: (data: any) => MockGuardResponse;
}

function createMockReqRes(options: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  superAdmin?: any;
} = {}) {
  const req = {
    headers: options.headers ?? {},
    cookies: options.cookies ?? {},
    superAdmin: options.superAdmin,
  } as unknown as Request;

  const res: MockGuardResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };

  return { req, res: res as unknown as Response & MockGuardResponse };
}

describe("Super Admin Guard & Token Extraction", () => {
  describe("Token Generation and Verification", () => {
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

  describe("extractSuperAdminToken", () => {
    it("extracts token from Authorization: Bearer header", () => {
      const { req } = createMockReqRes({
        headers: { authorization: "Bearer token_from_bearer" },
      });
      expect(extractSuperAdminToken(req)).toBe("token_from_bearer");
    });

    it("extracts token from x-super-admin-token header", () => {
      const { req } = createMockReqRes({
        headers: { "x-super-admin-token": "token_from_custom_header" },
      });
      expect(extractSuperAdminToken(req)).toBe("token_from_custom_header");
    });

    it("extracts token from cookie super_admin_token", () => {
      const { req } = createMockReqRes({
        cookies: { super_admin_token: "token_from_cookie" },
      });
      expect(extractSuperAdminToken(req)).toBe("token_from_cookie");
    });

    it("prioritizes Bearer header over cookie", () => {
      const { req } = createMockReqRes({
        headers: { authorization: "Bearer token_from_header" },
        cookies: { super_admin_token: "token_from_cookie" },
      });
      expect(extractSuperAdminToken(req)).toBe("token_from_header");
    });

    it("returns undefined if no token provided", () => {
      const { req } = createMockReqRes();
      expect(extractSuperAdminToken(req)).toBeUndefined();
    });
  });

  describe("requireSuperAdmin Middleware", () => {
    it("authenticates valid token and attaches req.superAdmin", async () => {
      const token = generateSuperAdminToken({
        adminId: "sa_001",
        email: "admin@smartbusiness.us",
        name: "Super Administrator",
        role: "SUPER_ADMIN",
      });

      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      const next = vi.fn();
      await requireSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.superAdmin).toEqual({
        adminId: "sa_001",
        email: "admin@smartbusiness.us",
        name: "Super Administrator",
        role: "SUPER_ADMIN",
      });
    });

    it("returns 401 when token is missing", async () => {
      const { req, res } = createMockReqRes();
      const next = vi.fn();

      await requireSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Super Administrator authentication required");
    });

    it("returns 401 when token is tampered/invalid", async () => {
      const { req, res } = createMockReqRes({
        headers: { authorization: "Bearer forged_invalid_token" },
      });
      const next = vi.fn();

      await requireSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Invalid or expired Super Admin credentials");
    });
  });

  describe("requireDevSuperAdmin Middleware", () => {
    it("allows DEV_SUPER_ADMIN role to proceed", async () => {
      const { req, res } = createMockReqRes({
        superAdmin: {
          adminId: "dev_001",
          email: "dev@smartbusiness.us",
          name: "Dev Super Admin",
          role: "DEV_SUPER_ADMIN",
        },
      });

      const next = vi.fn();
      await requireDevSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it("returns 403 Forbidden when role is standard SUPER_ADMIN", async () => {
      const { req, res } = createMockReqRes({
        superAdmin: {
          adminId: "sa_001",
          email: "admin@smartbusiness.us",
          name: "Super Administrator",
          role: "SUPER_ADMIN",
        },
      });

      const next = vi.fn();
      await requireDevSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("restricted to Dev Super Admin accounts");
    });
  });
});
