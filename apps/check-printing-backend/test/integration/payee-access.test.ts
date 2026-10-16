import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// R-09: the payee directory is the vendor master file. Creating or changing a vendor is how
// a "fake vendor" fraud starts (a look-alike name, or the real vendor's address switched to
// the fraudster's PO box), so only people who maintain vendors (payee:write: Admin, Editor)
// may change it. Everyone in Check Printing may still read it.

function payeesApi(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/payees`;
  const headers = authHeaders(user);
  return {
    list: () => request(getApp()).get(base).set(headers),
    get: (id: string) => request(getApp()).get(`${base}/${id}`).set(headers),
    create: (body: Record<string, unknown>) => request(getApp()).post(base).set(headers).send(body),
    update: (id: string, body: Record<string, unknown>) => request(getApp()).put(`${base}/${id}`).set(headers).send(body),
    archive: (id: string) => request(getApp()).patch(`${base}/${id}/archive`).set(headers),
  };
}

const REAL_VENDOR = {
  name: "Hill Country Nursery",
  addressLine1: "100 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
};

describe("payee directory access (R-09)", () => {
  let world: TestWorld;
  let vendorId: string;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
    const res = await payeesApi(world, world.editor).create(REAL_VENDOR);
    expect(res.status).toBe(201);
    vendorId = res.body.data.id;
  });

  describe.each([
    ["Viewer", (w: TestWorld) => w.viewer],
    ["Printer", (w: TestWorld) => w.printer],
    ["Approver", (w: TestWorld) => w.approver1],
  ])("a %s", (_label, pick) => {
    it("cannot add a vendor", async () => {
      const res = await payeesApi(world, pick(world)).create({ name: "Hill Country Nursery LLC", addressLine1: "PO Box 666" });

      expect(res.status).toBe(403);
      expect(await prisma.payee.count({ where: { workspaceId: world.workspaceId } })).toBe(1);
    });

    it("cannot change a vendor", async () => {
      const res = await payeesApi(world, pick(world)).update(vendorId, { addressLine1: "PO Box 666", zipCode: "78799" });

      expect(res.status).toBe(403);
      const vendor = await prisma.payee.findUniqueOrThrow({ where: { id: vendorId } });
      expect(vendor.addressLine1).toBe("100 Main St");
      expect(vendor.zipCode).toBe("78701");
    });

    it("can still read the directory", async () => {
      const api = payeesApi(world, pick(world));
      expect((await api.list()).status).toBe(200);
      expect((await api.get(vendorId)).status).toBe(200);
    });
  });

  it("a refused change leaves an ACCESS_DENIED entry in the audit log", async () => {
    await payeesApi(world, world.approver1).update(vendorId, { addressLine1: "PO Box 666" });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCESS_DENIED", userId: world.approver1.id } });
    expect(audit.detailsJson).toMatchObject({ missing: ["payee:write"], method: "PUT" });
  });

  it.each([
    ["Editor", (w: TestWorld) => w.editor],
    ["Admin", (w: TestWorld) => w.admin],
  ])("an %s can add and change vendors", async (_label, pick) => {
    const api = payeesApi(world, pick(world));

    expect((await api.create({ name: "Austin Equipment Rentals" })).status).toBe(201);
    expect((await api.update(vendorId, { city: "Round Rock" })).status).toBe(200);
  });

  it("archiving stays with Admins", async () => {
    expect((await payeesApi(world, world.editor).archive(vendorId)).status).toBe(403);
    expect((await payeesApi(world, world.admin).archive(vendorId)).status).toBe(200);
  });

  describe("the audit log of a vendor change", () => {
    it("records each changed field's old and new value", async () => {
      await payeesApi(world, world.editor).update(vendorId, { addressLine1: "PO Box 666", zipCode: "78799", city: "Austin" });

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PAYEE_UPDATED", entityId: vendorId } });
      expect(audit.detailsJson).toEqual({
        name: "Hill Country Nursery",
        changes: {
          addressLine1: { from: "100 Main St", to: "PO Box 666" },
          zipCode: { from: "78701", to: "78799" },
        },
      });
    });

    it("records a rename with the old and new name", async () => {
      await payeesApi(world, world.editor).update(vendorId, { name: "Hill Country Nursery & Landscape" });

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PAYEE_UPDATED", entityId: vendorId } });
      expect(audit.detailsJson).toMatchObject({
        changes: { name: { from: "Hill Country Nursery", to: "Hill Country Nursery & Landscape" } },
      });
    });

    it("records a cleared field as changed to null", async () => {
      await payeesApi(world, world.editor).update(vendorId, { addressLine1: "" });

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PAYEE_UPDATED", entityId: vendorId } });
      expect(audit.detailsJson).toMatchObject({ changes: { addressLine1: { from: "100 Main St", to: null } } });
    });

    it("writes nothing when no value actually changes", async () => {
      const res = await payeesApi(world, world.editor).update(vendorId, { city: "Austin" });

      expect(res.status).toBe(200);
      expect(await prisma.auditLog.count({ where: { action: "PAYEE_UPDATED" } })).toBe(0);
    });
  });

  describe("vendor names", () => {
    // 60 wide letters: under the 200-character limit, but wider than the payee line of a check.
    const TOO_WIDE = "W".repeat(60);

    it("a name that cannot fit on a check is refused when adding a vendor", async () => {
      const res = await payeesApi(world, world.editor).create({ name: TOO_WIDE });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toMatch(/too long to fit/);
    });

    it("a name that cannot fit on a check is refused when renaming a vendor", async () => {
      const res = await payeesApi(world, world.editor).update(vendorId, { name: TOO_WIDE });

      expect(res.status).toBe(400);
      expect((await prisma.payee.findUniqueOrThrow({ where: { id: vendorId } })).name).toBe("Hill Country Nursery");
    });
  });
});
