import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// R-13: login tokens are checked by signature only and last up to 15 minutes. A user who is
// deactivated or deleted must lose access at once, not when their token expires. The shared
// tenant check (packages/auth) re-reads the user with the membership it already loads.

describe("a user who was deactivated or deleted after logging in (R-13)", () => {
  let world: TestWorld;
  let headers: Record<string, string>;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
    headers = authHeaders(world.editor); // a token issued while the user was still active
  });

  // Failed once in six full-suite runs on 2026-10-16 (never in isolation) without its error being
  // captured; the response body is now part of the assertion message so a recurrence shows why.
  it("keeps access while active", async () => {
    const res = await request(getApp()).get("/api/v1/workspaces").set(headers);
    expect(res.status, `unexpected response: ${JSON.stringify(res.body)}`).toBe(200);
  });

  it.each([
    ["deactivated", { isActive: false }],
    ["deleted", { deletedAt: new Date() }],
  ])("is refused at once when %s, on every route", async (_label, change) => {
    await prisma.user.update({ where: { id: world.editor.id }, data: change });

    const list = await request(getApp()).get("/api/v1/workspaces").set(headers);
    const checks = await request(getApp()).get(`/api/v1/workspaces/${world.workspaceId}/checks`).set(headers);

    expect(list.status).toBe(401);
    expect(list.body.error.message).toMatch(/deactivated/);
    expect(checks.status).toBe(401);
  });
});
