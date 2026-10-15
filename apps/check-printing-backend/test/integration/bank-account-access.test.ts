import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

// A1: anyone who writes checks can SEE the bank accounts (masked) to choose one;
// only bank-account managers can CHANGE them.

function bankApi(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/bank-accounts`;
  const headers = authHeaders(user);
  return {
    list: () => request(getApp()).get(base).set(headers),
    get: (id: string) => request(getApp()).get(`${base}/${id}`).set(headers),
    create: () =>
      request(getApp()).post(base).set(headers).send({
        routingNumber: "026009593",
        accountNumber: "123456785678",
        accountType: "CHECKING",
        startingCheckNumber: 2001,
      }),
    update: (id: string) => request(getApp()).put(`${base}/${id}`).set(headers).send({ isActive: false }),
    remove: (id: string) => request(getApp()).delete(`${base}/${id}`).set(headers),
  };
}

describe("bank account access", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("an Editor (writes checks)", () => {
    it("can list the workspace's bank accounts", async () => {
      const res = await bankApi(world, world.editor).list();

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: world.bankAccountId,
        bankName: "JPMorgan Chase",
        accountNumber: "*****1012",
        routingNumber: "*****0025",
        isActive: true,
      });
    });

    it("can open one bank account", async () => {
      const res = await bankApi(world, world.editor).get(world.bankAccountId);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(world.bankAccountId);
    });

    it("can choose an account and write a check against it", async () => {
      const accounts = await bankApi(world, world.editor).list();
      const chosen = accounts.body.data[0].id;

      const check = await checksApi(world, world.editor).create({ bankAccountId: chosen });
      expect(check.status).toBe(201);
      expect(check.body.data.bankAccount.id).toBe(chosen);
    });

    it.each([
      ["create", (api: ReturnType<typeof bankApi>, _id: string) => api.create()],
      ["edit", (api: ReturnType<typeof bankApi>, id: string) => api.update(id)],
      ["delete", (api: ReturnType<typeof bankApi>, id: string) => api.remove(id)],
    ])("cannot %s a bank account", async (_action, call) => {
      const res = await call(bankApi(world, world.editor), world.bankAccountId);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      const account = await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } });
      expect(account.isActive).toBe(true);
      expect(account.deletedAt).toBeNull();
      expect(await prisma.bankAccount.count()).toBe(1);
    });
  });

  it.each(["approver1", "printer", "viewer"] as const)(
    "a %s, who does not write checks, cannot list bank accounts",
    async (role) => {
      const res = await bankApi(world, world[role]).list();
      expect(res.status).toBe(403);
    },
  );

  it("records a refused view with the 'any of' rule in the audit log", async () => {
    await bankApi(world, world.viewer).list();

    const denied = await prisma.auditLog.findFirstOrThrow({
      where: { action: "ACCESS_DENIED", userId: world.viewer.id },
    });
    expect(denied.detailsJson).toMatchObject({
      rule: "any",
      required: ["bank-account:manage", "check:create"],
    });
  });

  it("records a refused change with the 'all of' rule in the audit log", async () => {
    await bankApi(world, world.editor).update(world.bankAccountId);

    const denied = await prisma.auditLog.findFirstOrThrow({
      where: { action: "ACCESS_DENIED", userId: world.editor.id },
    });
    expect(denied.detailsJson).toMatchObject({ rule: "all", missing: ["bank-account:manage"] });
  });

  it("an Admin can still create, edit and delete", async () => {
    const admin = bankApi(world, world.admin);

    const created = await admin.create();
    expect(created.status).toBe(201);
    expect((await admin.update(created.body.data.id)).status).toBe(200);
    expect((await admin.remove(created.body.data.id)).status).toBe(204);
  });

  it("never returns full bank numbers or storage paths", async () => {
    await prisma.bankAccount.update({
      where: { id: world.bankAccountId },
      data: { signatureStorageKey: "signatures/ws/secret-path.png" },
    });

    const res = await bankApi(world, world.editor).list();
    const body = JSON.stringify(res.body);

    expect(body).not.toContain("987654321012");
    expect(body).not.toContain("111000025");
    expect(body).not.toContain("secret-path");
    expect(res.body.data[0]).not.toHaveProperty("signatureStorageKey");
    expect(res.body.data[0].hasSignature).toBe(true);
  });

  it("an Editor of another company cannot see these accounts", async () => {
    const other = await createWorld();
    const res = await request(getApp())
      .get(`/api/v1/workspaces/${world.workspaceId}/bank-accounts`)
      .set(authHeaders(other.editor));

    expect(res.status).toBe(404);
  });
});
