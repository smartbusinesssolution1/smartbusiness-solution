import { describe, expect, it } from "vitest";
import {
  superAdminLoginSchema,
  createOrganizationSchema,
  createPlanSchema,
  updatePlanSchema,
  telemetryQuerySchema,
  paginationQuerySchema,
} from "../../src/modules/super-admin/super-admin.schema.js";

describe("Super Admin Validation Schemas", () => {
  describe("superAdminLoginSchema", () => {
    it("accepts valid email and password", () => {
      const valid = superAdminLoginSchema.safeParse({
        email: "admin@smartbusiness.us",
        password: "SuperAdmin@2026!",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid email formats", () => {
      const invalid = superAdminLoginSchema.safeParse({
        email: "not-an-email",
        password: "SuperAdmin@2026!",
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects empty passwords", () => {
      const invalid = superAdminLoginSchema.safeParse({
        email: "admin@smartbusiness.us",
        password: "",
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects empty / missing fields", () => {
      const invalid = superAdminLoginSchema.safeParse({});
      expect(invalid.success).toBe(false);
    });
  });

  describe("createOrganizationSchema", () => {
    const validPayload = {
      tenantName: "Apex Logistics Corp",
      billingEmail: "billing@apexlogistics.test",
      fullName: "Marcus Vance",
      email: "marcus@apexlogistics.test",
      city: "Austin",
      state: "TX",
      workspaceName: "Apex Austin Yard",
      serviceType: "BOTH" as const,
      planName: "Enterprise All-Access Bundle",
      planPrice: 299,
      planDuration: "Monthly (1 Month)",
    };

    it("accepts fully valid organization creation payload", () => {
      const res = createOrganizationSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
    });

    it("accepts CHECK_PRINTING and CLOCK_IN_CLOCK_OUT service types", () => {
      const cp = createOrganizationSchema.safeParse({
        ...validPayload,
        serviceType: "CHECK_PRINTING",
      });
      expect(cp.success).toBe(true);

      const cico = createOrganizationSchema.safeParse({
        ...validPayload,
        serviceType: "CLOCK_IN_CLOCK_OUT",
      });
      expect(cico.success).toBe(true);
    });

    it("rejects invalid service types", () => {
      const invalid = createOrganizationSchema.safeParse({
        ...validPayload,
        serviceType: "UNKNOWN_SERVICE",
      });
      expect(invalid.success).toBe(false);
    });

    it("enforces state code to be non-empty", () => {
      const emptyState = createOrganizationSchema.safeParse({
        ...validPayload,
        state: "",
      });
      expect(emptyState.success).toBe(false);
    });

    it("rejects negative plan price", () => {
      const invalid = createOrganizationSchema.safeParse({
        ...validPayload,
        planPrice: -10,
      });
      expect(invalid.success).toBe(false);
    });

    it("accepts optional password if provided with at least 8 chars", () => {
      const withPass = createOrganizationSchema.safeParse({
        ...validPayload,
        password: "ValidPass123!",
      });
      expect(withPass.success).toBe(true);

      const shortPass = createOrganizationSchema.safeParse({
        ...validPayload,
        password: "short",
      });
      expect(shortPass.success).toBe(false);
    });
  });

  describe("createPlanSchema", () => {
    it("accepts valid plan payload", () => {
      const res = createPlanSchema.safeParse({
        name: "Check Pro Tier",
        service: "CHECK_PRINTING",
        durationCount: 1,
        durationUnit: "MONTH",
        price: 49.99,
        status: "ACTIVE",
        description: "Full check issuing suite",
      });
      expect(res.success).toBe(true);
    });

    it("defaults status to ACTIVE when omitted", () => {
      const res = createPlanSchema.safeParse({
        name: "Check Pro Tier",
        service: "CHECK_PRINTING",
        durationCount: 1,
        durationUnit: "MONTH",
        price: 49.99,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("ACTIVE");
      }
    });

    it("rejects invalid duration unit", () => {
      const res = createPlanSchema.safeParse({
        name: "Check Pro Tier",
        service: "CHECK_PRINTING",
        durationCount: 1,
        durationUnit: "CENTURY",
        price: 49.99,
      });
      expect(res.success).toBe(false);
    });

    it("rejects duration count less than 1", () => {
      const res = createPlanSchema.safeParse({
        name: "Check Pro Tier",
        service: "CHECK_PRINTING",
        durationCount: 0,
        durationUnit: "MONTH",
        price: 49.99,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("updatePlanSchema", () => {
    it("allows partial updates", () => {
      const nameOnly = updatePlanSchema.safeParse({ name: "Renamed Plan" });
      expect(nameOnly.success).toBe(true);

      const priceOnly = updatePlanSchema.safeParse({ price: 199 });
      expect(priceOnly.success).toBe(true);

      const statusOnly = updatePlanSchema.safeParse({ status: "INACTIVE" });
      expect(statusOnly.success).toBe(true);
    });

    it("rejects negative updated price", () => {
      const res = updatePlanSchema.safeParse({ price: -50 });
      expect(res.success).toBe(false);
    });
  });

  describe("telemetryQuerySchema & paginationQuerySchema", () => {
    it("coerces string queries into integers with defaults", () => {
      const res = paginationQuerySchema.safeParse({
        page: "2",
        pageSize: "50",
        search: "Apex",
        status: "ACTIVE",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(2);
        expect(res.data.pageSize).toBe(50);
        expect(res.data.search).toBe("Apex");
      }
    });

    it("coerces telemetry severity and limit", () => {
      const res = telemetryQuerySchema.safeParse({
        severity: "ERROR",
        limit: "100",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.severity).toBe("ERROR");
        expect(res.data.limit).toBe(100);
      }
    });

    it("rejects invalid telemetry severity", () => {
      const res = telemetryQuerySchema.safeParse({
        severity: "FATAL_CRITICAL",
      });
      expect(res.success).toBe(false);
    });
  });
});
