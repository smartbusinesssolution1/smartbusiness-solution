import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// Accounts are created on the portal now, and a company may sign in without having Check
// Printing. The refusal carries its own code, so the app can show "your company doesn't
// have Check Printing" with a way to the portal, instead of a generic "access denied".

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

describe("a company without Check Printing", () => {
  it.each(["CANCELED", "EXPIRED"] as const)("is refused with PRODUCT_NOT_AVAILABLE when its access is %s", async (status) => {
    await prisma.productSubscription.updateMany({ where: { tenantId: world.tenantId }, data: { status } });

    const res = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(world.admin));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PRODUCT_NOT_AVAILABLE");
    // The message is unchanged, for anything that shows it as it is.
    expect(res.body.error.message).toBe("Your organization does not have an active subscription to this product.");
  });

  it("that never had it is refused the same way", async () => {
    await prisma.productSubscription.deleteMany({ where: { tenantId: world.tenantId } });

    const res = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(world.admin));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PRODUCT_NOT_AVAILABLE");
  });
});

describe("other refusals keep their own code", () => {
  it("a workspace the user isn't a member of is not reported as a missing product", async () => {
    const other = await createWorld();

    const res = await request(getApp())
      .get(`/api/v1/workspaces/${other.workspaceId}`)
      .set(authHeaders(world.admin));

    expect(res.status).not.toBe(200);
    expect(res.body.error.code).not.toBe("PRODUCT_NOT_AVAILABLE");
  });

  it("a company with Check Printing gets in", async () => {
    const res = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(world.admin));

    expect(res.status).toBe(200);
  });
});
