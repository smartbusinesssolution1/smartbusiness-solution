import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { BankAccountService } from "../../src/modules/bank-account/bank-account.service.js";
import { BankAccountRepository } from "../../src/modules/bank-account/bank-account.repository.js";
import { AuditService } from "../../src/shared/services/audit.service.js";
import { fileStorage } from "../../src/shared/storage/instance.js";

// R-08: two records for the same real bank account each keep their own check counter, so
// two different checks get the same number at the bank. Account numbers are encrypted with a
// random IV (the same number never encrypts the same way), so duplicates are found through a
// keyed fingerprint (HMAC) of routing + account number, scoped to one company (tenant).

const ACCOUNT = { routingNumber: "026009593", accountNumber: "123456785678", accountType: "CHECKING" };

function bankApi(workspaceId: string, user: TestUser) {
  const base = `/api/v1/workspaces/${workspaceId}/bank-accounts`;
  const headers = authHeaders(user);
  return {
    create: (body: Record<string, unknown> = {}) =>
      request(getApp()).post(base).set(headers).send({ ...ACCOUNT, startingCheckNumber: 2001, ...body }),
    get: (id: string) => request(getApp()).get(`${base}/${id}`).set(headers),
    update: (id: string, body: Record<string, unknown>) => request(getApp()).put(`${base}/${id}`).set(headers).send(body),
    remove: (id: string) => request(getApp()).delete(`${base}/${id}`).set(headers),
    restore: (id: string) => request(getApp()).post(`${base}/${id}/restore`).set(headers).send({}),
  };
}

async function writeCheck(world: TestWorld, workspaceId: string, bankAccountId: string, user: TestUser) {
  return request(getApp())
    .post(`/api/v1/workspaces/${workspaceId}/checks`)
    .set(authHeaders(user))
    .send({ bankAccountId, payeeName: "Hill Country Nursery", amount: 500, checkDate: today() });
}

const accountsInWorkspace = (workspaceId: string) => prisma.bankAccount.count({ where: { workspaceId } });

describe("duplicate bank accounts (R-08)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("in the same workspace", () => {
    it("the same account cannot be added twice", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      expect((await api.create()).status).toBe(201);

      const again = await api.create();

      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("BANK_ACCOUNT_EXISTS");
      expect(again.body.error.message).toMatch(/\*\*\*\*5678/);
      expect(await accountsInWorkspace(world.workspaceId)).toBe(2); // the fixture's account + one
    });

    it("an account created before fingerprints existed is still recognised", async () => {
      // The fixture's account was written straight to the database, like pre-R-08 rows: no fingerprint.
      const legacy = await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } });
      expect(legacy.accountFingerprint).toBeNull();

      const res = await bankApi(world.workspaceId, world.admin).create({ routingNumber: "111000025", accountNumber: "987654321012" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("BANK_ACCOUNT_EXISTS");
    });

    it("a deactivated duplicate must be reactivated, not added again", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      const first = await api.create();
      await api.update(first.body.data.id, { isActive: false });

      const again = await api.create();

      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("BANK_ACCOUNT_INACTIVE");
    });

    it("the same account number at a different bank is a different account", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      expect((await api.create()).status).toBe(201);

      const otherBank = await api.create({ routingNumber: "111000025" });

      expect(otherBank.status).toBe(201);
    });

    // Called on the service directly: HTTP spreads requests apart and can hide a race (R-01).
    it("two admins adding it at the same moment create exactly one record", async () => {
      const service = new BankAccountService(new BankAccountRepository(), new AuditService(), fileStorage);
      const ctx = { userId: world.admin.id, tenantId: world.tenantId };
      const input = { ...ACCOUNT, accountType: "CHECKING" as const, startingCheckNumber: 2001 };

      const results = await Promise.allSettled([
        service.createBankAccount(world.workspaceId, input, ctx),
        service.createBankAccount(world.workspaceId, input, ctx),
        service.createBankAccount(world.workspaceId, input, ctx),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await accountsInWorkspace(world.workspaceId)).toBe(2);
    });
  });

  describe("a deleted duplicate", () => {
    it("is refused with a pointer to restore it, and restoring continues its check numbers", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      const created = await api.create();
      const id = created.body.data.id;
      expect((await writeCheck(world, world.workspaceId, id, world.editor)).body.data.checkNumber).toBe(2001);
      expect((await writeCheck(world, world.workspaceId, id, world.editor)).body.data.checkNumber).toBe(2002);
      expect((await api.remove(id)).status).toBe(204);

      const again = await api.create();
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("BANK_ACCOUNT_DELETED");
      expect(again.body.error.message).toContain(`/bank-accounts/${id}/restore`);
      expect(again.body.error.message).toMatch(/#2003/);

      const restored = await api.restore(id);
      expect(restored.status).toBe(200);
      expect(restored.body.data).toMatchObject({ id, nextCheckNumber: 2003 });

      const next = await writeCheck(world, world.workspaceId, id, world.editor);
      expect(next.status).toBe(201);
      expect(next.body.data.checkNumber).toBe(2003);
    });

    it("restoring is recorded in the audit log", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      const id = (await api.create()).body.data.id;
      await api.remove(id);

      await api.restore(id);

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BANK_ACCOUNT_RESTORED", entityId: id } });
      expect(audit.detailsJson).toMatchObject({ nextCheckNumber: 2001 });
    });

    it("only bank-account managers can restore", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      const id = (await api.create()).body.data.id;
      await api.remove(id);

      expect((await bankApi(world.workspaceId, world.editor).restore(id)).status).toBe(403);
    });

    it("restoring is refused while old data still holds a live record of the same account", async () => {
      // The fixture's account (no fingerprint, like pre-R-08 data) is live; a fingerprinted
      // record of the same numbers was deleted earlier.
      const deleted = await prisma.bankAccount.create({
        data: {
          workspaceId: world.workspaceId,
          bankName: "JPMorgan Chase",
          routingNumberEncrypted: (await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } })).routingNumberEncrypted,
          routingNumberLast4: "0025",
          accountNumberEncrypted: (await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } })).accountNumberEncrypted,
          accountNumberLast4: "1012",
          nextCheckNumber: 1500,
          deletedAt: new Date(),
        },
      });

      const res = await bankApi(world.workspaceId, world.admin).restore(deleted.id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("BANK_ACCOUNT_EXISTS");
      expect((await prisma.bankAccount.findUniqueOrThrow({ where: { id: deleted.id } })).deletedAt).not.toBeNull();
    });

    it("an account that is not deleted cannot be restored", async () => {
      const res = await bankApi(world.workspaceId, world.admin).restore(world.bankAccountId);
      expect(res.status).toBe(404);
    });
  });

  describe("across workspaces and companies", () => {
    it("the same account cannot be set up in two workspaces of the same company", async () => {
      expect((await bankApi(world.workspaceId, world.admin).create()).status).toBe(201);
      const second = await request(getApp())
        .post("/api/v1/workspaces")
        .set(authHeaders(world.admin))
        .send({ businessName: "Green Acres Design LLC", addressLine1: "1 Elm St", city: "Austin", state: "TX", zipCode: "78701" });
      expect(second.status).toBe(201);

      const res = await bankApi(second.body.data.id, world.admin).create();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("BANK_ACCOUNT_IN_OTHER_WORKSPACE");
      expect(res.body.error.message).toMatch(/Green Acres Landscaping LLC/);
    });

    // The unique index works per workspace; only the company lock stops two workspaces racing.
    it("two workspaces of one company adding it at the same moment create exactly one record", async () => {
      const second = await request(getApp())
        .post("/api/v1/workspaces")
        .set(authHeaders(world.admin))
        .send({ businessName: "Green Acres Design LLC", addressLine1: "1 Elm St", city: "Austin", state: "TX", zipCode: "78701" });
      const service = new BankAccountService(new BankAccountRepository(), new AuditService(), fileStorage);
      const ctx = { userId: world.admin.id, tenantId: world.tenantId };
      const input = { ...ACCOUNT, accountType: "CHECKING" as const, startingCheckNumber: 2001 };

      const results = await Promise.allSettled([
        service.createBankAccount(world.workspaceId, input, ctx),
        service.createBankAccount(second.body.data.id, input, ctx),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.bankAccount.count({ where: { accountNumberLast4: "5678" } })).toBe(1);
    });

    // The race above rarely overlaps in a test (opening a second pool connection takes longer
    // than the first transaction), so the protection itself is tested: while someone else holds
    // the company lock, adding an account must wait, then finish once the lock is released.
    it("adding an account waits for the company lock, so concurrent adds take turns", async () => {
      const service = new BankAccountService(new BankAccountRepository(), new AuditService(), fileStorage);
      const ctx = { userId: world.admin.id, tenantId: world.tenantId };
      const input = { ...ACCOUNT, accountType: "CHECKING" as const, startingCheckNumber: 2001 };
      let lockHeld!: () => void;
      let release!: () => void;
      const held = new Promise<void>((resolve) => (lockHeld = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));

      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${world.tenantId} FOR NO KEY UPDATE`;
          lockHeld();
          await released;
        },
        { timeout: 20_000 },
      );
      await held;

      let settled = false;
      const adding = service.createBankAccount(world.workspaceId, input, ctx).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 750));
      expect(settled).toBe(false);
      expect(await prisma.bankAccount.count({ where: { accountNumberLast4: "5678" } })).toBe(0);

      release();
      await holder;
      await adding;
      expect(settled).toBe(true);
    });

    it("another company may use the same account: we never reveal one company's banking to another", async () => {
      expect((await bankApi(world.workspaceId, world.admin).create()).status).toBe(201);
      const otherCompany = await createWorld();

      const res = await bankApi(otherCompany.workspaceId, otherCompany.admin).create();

      expect(res.status).toBe(201);
    });
  });

  describe("the fingerprint", () => {
    it("is stored, is not a plain SHA-256, and never appears in API responses", async () => {
      const api = bankApi(world.workspaceId, world.admin);
      const created = await api.create();
      const row = await prisma.bankAccount.findUniqueOrThrow({ where: { id: created.body.data.id } });

      expect(row.accountFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(row.accountFingerprint).not.toBe(createHash("sha256").update("026009593:123456785678").digest("hex"));
      expect(JSON.stringify(created.body)).not.toContain(row.accountFingerprint!);
      expect(JSON.stringify((await api.get(created.body.data.id)).body)).not.toContain(row.accountFingerprint!);
    });
  });
});
