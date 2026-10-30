import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { TEST_JWT_SECRET } from "../setup/test-env.js";
import { ROLES } from "../../src/shared/constants/rbac.js";

// S9 and C1: small hardening and cleanup, one block per change.

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

// S9-1: login tokens are checked with the one algorithm they're signed with.
describe("login tokens", () => {
  const sessionSignedWith = (algorithm: jwt.Algorithm) => {
    const token = jwt.sign({ userId: world.admin.id, email: world.admin.email, amr: ["pwd", "otp"] }, TEST_JWT_SECRET, { algorithm, expiresIn: "15m" });
    return { Cookie: `access_token=${token}`, "X-Tenant-Id": world.tenantId };
  };

  it("a token signed with HS256 works", async () => {
    expect((await request(getApp()).get("/api/v1/workspaces").set(sessionSignedWith("HS256"))).status).toBe(200);
  });

  it.each(["HS384", "HS512"] as const)("a token signed with %s is refused, even with the right secret", async (algorithm) => {
    expect((await request(getApp()).get("/api/v1/workspaces").set(sessionSignedWith(algorithm))).status).toBe(401);
  });
});

// S9-2: the routing-number lookup is behind the same door as every Check Printing route.
describe("routing-number lookup", () => {
  const lookup = (headers: Record<string, string>) =>
    request(getApp()).post("/api/v1/validate-routing-number").set(headers).send({ routingNumber: "111000025" });

  it("works for a member of a company with Check Printing", async () => {
    expect((await lookup(authHeaders(world.viewer))).status).toBe(200);
  });

  it("is refused without a company (no X-Tenant-Id)", async () => {
    const { "X-Tenant-Id": _tenant, ...signedInOnly } = authHeaders(world.viewer);
    expect((await lookup(signedInOnly)).status).toBe(401);
  });

  it("is refused for a company that doesn't have Check Printing", async () => {
    await prisma.productSubscription.updateMany({ where: { tenantId: world.tenantId }, data: { status: "CANCELED" } });
    expect((await lookup(authHeaders(world.viewer))).status).toBe(403);
  });
});

// S9-3: a member can't be sent an unbounded list of roles.
describe("roles in one request", () => {
  it("more than 10 roles are refused", async () => {
    const member = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: world.viewer.id } });
    const res = await request(getApp())
      .put(`/api/v1/workspaces/${world.workspaceId}/members/${member.id}`)
      .set(authHeaders(world.admin))
      .send({ roleSlugs: Array.from({ length: 11 }, () => ROLES.VIEWER) });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/At most 10 roles/);
  });
});

// C1-1: an approval threshold can't exceed the largest possible check.
describe("approval rule amounts", () => {
  const createRule = (body: Record<string, unknown>) =>
    request(getApp()).post(`/api/v1/workspaces/${world.workspaceId}/approval-rules`).set(authHeaders(world.admin)).send(body);

  it("a threshold up to $999,999.99 is accepted", async () => {
    expect((await createRule({ minAmount: 999_999.99 })).status).toBe(201);
  });

  it.each([
    [{ minAmount: 1_000_000 }, "minimum"],
    [{ minAmount: 1000, maxAmount: 1_000_000 }, "maximum"],
  ])("a %s above the check maximum is refused (%s)", async (body, _which) => {
    const res = await createRule(body);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/largest amount a check can have/);
  });
});
