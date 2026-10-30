import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProductNotAvailable, portalSignUpUrl, portalUrl } from "../src/lib/portal";
import { ApiError } from "../src/lib/api";
import { chooseTenant } from "../src/api/auth";
import type { Session } from "../src/api/types";

// Sign-up moved to the SmartBusiness portal. Check Printing links there, and accepts the
// company the portal opened it for (?tenant=), but only one of the user's own companies.

describe("portal address", () => {
  it("uses the configured portal subdomain", () => {
    assert.equal(portalUrl({ VITE_PORTAL_URL: "https://app.example.com/" }), "https://app.example.com");
    assert.equal(portalSignUpUrl({ VITE_PORTAL_URL: "https://app.example.com" }), "https://app.example.com/?start=signup");
  });

  it("in development, falls back to the portal's local port", () => {
    assert.equal(portalSignUpUrl({ DEV: true }), "http://localhost:3003/?start=signup");
  });

  it("a production build without the address gives no link, never localhost", () => {
    assert.equal(portalUrl({ DEV: false }), null);
    assert.equal(portalSignUpUrl({ DEV: false, VITE_PORTAL_URL: "  " }), null);
  });
});

describe("isProductNotAvailable", () => {
  const message = "Your organization does not have an active subscription to this product.";

  // Every code the shared requireProduct sends for a company without Check Printing.
  for (const code of ["SUBSCRIPTION_EXPIRED", "SUBSCRIPTION_INACTIVE", "PRODUCT_NOT_AVAILABLE"]) {
    it(`is true for ${code}`, () => {
      assert.equal(isProductNotAvailable(new ApiError(403, code, message)), true);
    });
  }

  it("is false for any other refusal (not a member, no permission) or error", () => {
    assert.equal(isProductNotAvailable(new ApiError(403, "FORBIDDEN", "You are not a member of this organization.")), false);
    assert.equal(isProductNotAvailable(new Error("network")), false);
  });
});

describe("chooseTenant", () => {
  const session = {
    user: { id: "u1", email: "maria@example.test", fullName: "Maria" },
    tenants: [
      { tenantId: "company-a", tenantName: "A", role: "OWNER", status: "ACTIVE" },
      { tenantId: "company-b", tenantName: "B", role: "MEMBER", status: "ACTIVE" },
    ],
  } as unknown as Session;

  // The browser's storage, where the chosen company is remembered.
  let stored: Map<string, string>;
  beforeEach(() => {
    stored = new Map();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => void stored.set(k, v),
      removeItem: (k: string) => void stored.delete(k),
    };
  });

  it("takes the company the portal link names, over the one remembered", () => {
    stored.set("sb.tenantId", "company-a");

    assert.equal(chooseTenant(session, "company-b"), "company-b");
    assert.equal(stored.get("sb.tenantId"), "company-b");
  });

  it("ignores a named company the user doesn't belong to", () => {
    stored.set("sb.tenantId", "company-b");

    assert.equal(chooseTenant(session, "someone-elses-company"), "company-b");
  });

  it("without a link, keeps the remembered company, else the first", () => {
    stored.set("sb.tenantId", "company-b");
    assert.equal(chooseTenant(session), "company-b");

    stored.clear();
    assert.equal(chooseTenant(session), "company-a");
  });
});
