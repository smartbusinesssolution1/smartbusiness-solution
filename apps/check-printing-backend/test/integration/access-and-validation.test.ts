import { randomUUID } from "crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createPrinterProfile, createWorld, today, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

const checksUrl = (world: TestWorld) => `/api/v1/workspaces/${world.workspaceId}/checks`;

const validCheck = (world: TestWorld, overrides: Record<string, unknown> = {}) => ({
  bankAccountId: world.bankAccountId,
  payeeName: "Hill Country Supply Co.",
  amount: 1250.5,
  checkDate: today(),
  ...overrides,
});

describe("tenant isolation", () => {
  let a: TestWorld;
  let b: TestWorld;
  let checkInA: string;

  beforeEach(async () => {
    await resetDatabase();
    a = await createWorld();
    b = await createWorld();
    const created = await checksApi(a, a.editor).create();
    expect(created.status).toBe(201);
    checkInA = created.body.data.id;
  });

  it("a member of tenant B cannot open tenant A's workspace", async () => {
    const res = await request(getApp()).get(`${checksUrl(a)}/${checkInA}`).set(authHeaders(b.admin));
    expect(res.status).toBe(404);
  });

  it("a member of tenant B cannot claim tenant A with the X-Tenant-Id header", async () => {
    const res = await request(getApp())
      .get(`${checksUrl(a)}/${checkInA}`)
      .set({ ...authHeaders(b.admin), "X-Tenant-Id": a.tenantId });
    expect(res.status).toBe(403);
  });

  it("a check id from tenant A is not found inside tenant B's workspace", async () => {
    const res = await request(getApp()).get(`${checksUrl(b)}/${checkInA}`).set(authHeaders(b.admin));
    expect(res.status).toBe(404);
  });

  it("tenant B cannot act on tenant A's check through its own workspace", async () => {
    const asB = request(getApp());
    const url = `${checksUrl(b)}/${checkInA}`;
    const headers = authHeaders(b.admin);
    for (const res of [
      await asB.put(url).set(headers).send({ amount: 1 }),
      await asB.delete(url).set(headers),
      await asB.post(`${url}/submit`).set(headers).send({}),
      await asB.post(`${url}/void`).set(headers).send({ reason: "x" }),
      await asB.get(`${url}/pdf`).set(headers),
    ]) {
      expect(res.status).toBe(404);
    }
    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkInA } });
    expect(check.status).toBe("NEW");
    expect(check.deletedAt).toBeNull();
  });

  it("tenant B cannot write a check against tenant A's bank account", async () => {
    const res = await request(getApp())
      .post(checksUrl(b))
      .set(authHeaders(b.editor))
      .send(validCheck(b, { bankAccountId: a.bankAccountId }));
    expect(res.status).toBe(404);
    expect(await prisma.check.count({ where: { bankAccountId: a.bankAccountId } })).toBe(1);
  });

  it("tenant B cannot print with tenant A's printer profile", async () => {
    const profileInA = await createPrinterProfile(a);
    const created = await checksApi(b, b.editor).create();
    await prisma.check.update({ where: { id: created.body.data.id }, data: { status: "APPROVED" } });

    const res = await request(getApp())
      .post(`${checksUrl(b)}/${created.body.data.id}/print`)
      .set(authHeaders(b.printer))
      .send({ calibrationProfileId: profileInA });
    expect(res.status).toBe(404);
  });
});

describe("authentication and permissions", () => {
  let world: TestWorld;
  let checkId: string;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
    const created = await checksApi(world, world.editor).create();
    checkId = created.body.data.id;
  });

  it("rejects a request without a session", async () => {
    const res = await request(getApp()).get(checksUrl(world)).set("X-Tenant-Id", world.tenantId);
    expect(res.status).toBe(401);
  });

  it("rejects a forged or expired token", async () => {
    const res = await request(getApp())
      .get(checksUrl(world))
      .set({ Cookie: "access_token=not.a.jwt", "X-Tenant-Id": world.tenantId });
    expect(res.status).toBe(401);
  });

  it("rejects a request without a tenant", async () => {
    const { Cookie } = authHeaders(world.admin);
    const res = await request(getApp()).get(checksUrl(world)).set({ Cookie });
    expect(res.status).toBe(401);
  });

  it.each([
    ["viewer", "creates a check", "post", "", 403],
    ["editor", "approves a check", "post", "/approve", 403],
    ["approver", "prints a check", "post", "/print", 403],
    ["printer", "voids a check", "post", "/void", 403],
    ["viewer", "downloads a check PDF", "get", "/pdf", 403],
    // Editors may withdraw their OWN unprinted checks (void-and-print-outcome.test.ts);
    // someone who can neither void nor create checks is stopped at the door.
    ["approver", "voids a check", "post", "/void", 403],
  ] as const)("refuses when the %s %s", async (role, _action, method, suffix, status) => {
    const user = {
      viewer: world.viewer,
      editor: world.editor,
      approver: world.approver1,
      printer: world.printer,
    }[role];
    const url = suffix === "" ? checksUrl(world) : `${checksUrl(world)}/${checkId}${suffix}`;
    const res = await request(getApp())[method](url).set(authHeaders(user)).send(validCheck(world, { reason: "x" }));

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("records every refused action in the audit log", async () => {
    await request(getApp()).post(`${checksUrl(world)}/${checkId}/approve`).set(authHeaders(world.editor)).send({});
    const denied = await prisma.auditLog.findFirst({ where: { action: "ACCESS_DENIED", userId: world.editor.id } });
    expect(denied?.detailsJson).toMatchObject({ missing: ["check:approve"] });
  });

  it("lets every role read checks", async () => {
    for (const user of [world.viewer, world.editor, world.approver1, world.printer, world.admin]) {
      expect((await request(getApp()).get(`${checksUrl(world)}/${checkId}`).set(authHeaders(user))).status).toBe(200);
    }
  });
});

describe("amount validation (R-05: whole cents)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  it("refuses an amount with a third decimal instead of rounding it", async () => {
    const res = await checksApi(world, world.editor).create({ amount: 10.999 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toMatch(/whole cents/);
    expect(await prisma.check.count()).toBe(0);
  });

  it("refuses an invoice line with a third decimal", async () => {
    const res = await checksApi(world, world.editor).create({
      invoiceItems: [{ description: "Mulch", amount: 12.345 }],
    });
    expect(res.status).toBe(400);
  });

  it("stores amount and words that agree", async () => {
    const res = await checksApi(world, world.editor).create({ amount: 4.35 });
    expect(res.status).toBe(201);
    const check = await prisma.check.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(check.amount.toString()).toBe("4.35");
    expect(check.amountInWords).toBe("Four and 35/100");
  });

  it("refuses an amount above the workspace limit", async () => {
    const res = await checksApi(world, world.editor).create({ amount: 50000.01 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Amount exceeds maximum of $50,000.00");
  });
});

describe("idempotent check creation", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  const createWithKey = (key: string, overrides: Record<string, unknown> = {}) =>
    request(getApp())
      .post(checksUrl(world))
      .set({ ...authHeaders(world.editor), "Idempotency-Key": key })
      .send(validCheck(world, overrides));

  it("replays the first response for a retried request", async () => {
    const key = randomUUID();
    const first = await createWithKey(key);
    const retry = await createWithKey(key);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(await prisma.check.count()).toBe(1);
  });

  it("creates exactly one check when identical requests arrive together", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => createWithKey(key)));

    expect(await prisma.check.count()).toBe(1);
    for (const r of results) {
      // Either the original, a replay of it, or "still in progress, retry".
      expect([201, 409]).toContain(r.status);
      if (r.status === 409) expect(r.body.error.code).toBe("IDEMPOTENCY_IN_PROGRESS");
    }
    expect(results.filter((r) => r.status === 201 && !r.headers["idempotent-replayed"])).toHaveLength(1);
  });

  it("lets a failed request be retried with the same key", async () => {
    const key = randomUUID();
    const failed = await createWithKey(key, { amount: 10.999 });
    expect(failed.status).toBe(400);

    const fixed = await createWithKey(key);
    expect(fixed.status).toBe(201);
    expect(fixed.headers["idempotent-replayed"]).toBeUndefined();
  });

  it("frees the key before answering a failed request, even when the database is slow", async () => {
    // Slow the release down. The old code answered first and released afterwards, so a
    // client retrying immediately found the key still "in progress" (a flaky 409).
    const delegate = prisma.idempotencyRecord as unknown as { deleteMany: (...a: unknown[]) => Promise<unknown> };
    const original = delegate.deleteMany.bind(delegate);
    const spy = vi.spyOn(delegate, "deleteMany").mockImplementation(async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, 300));
      return original(...args);
    });

    try {
      const key = randomUUID();
      const failed = await createWithKey(key, { amount: 10.999 });
      expect(failed.status).toBe(400);
      // At the moment the client has the answer, the key must already be free.
      expect(await prisma.idempotencyRecord.count({ where: { key } })).toBe(0);
      expect((await createWithKey(key)).status).toBe(201);
    } finally {
      spy.mockRestore();
    }
  });

  it("refuses a key reused by the same user for a different request", async () => {
    const key = randomUUID();
    const asAdmin = { ...authHeaders(world.admin), "Idempotency-Key": key };
    const created = await request(getApp()).post(checksUrl(world)).set(asAdmin).send(validCheck(world));
    expect(created.status).toBe(201);

    const res = await request(getApp())
      .post(`${checksUrl(world)}/${created.body.data.id}/print`)
      .set(asAdmin)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("keeps each user's keys separate", async () => {
    const key = randomUUID();
    expect((await createWithKey(key)).status).toBe(201);
    const other = await request(getApp())
      .post(checksUrl(world))
      .set({ ...authHeaders(world.admin), "Idempotency-Key": key })
      .send(validCheck(world));
    expect(other.status).toBe(201);
    expect(other.headers["idempotent-replayed"]).toBeUndefined();
    expect(await prisma.check.count()).toBe(2);
  });

  it("rejects an oversized key", async () => {
    const res = await createWithKey("k".repeat(256));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });
});
