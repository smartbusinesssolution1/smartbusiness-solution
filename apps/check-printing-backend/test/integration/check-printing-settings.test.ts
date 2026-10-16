import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { CheckPrintingSettingsRepository } from "../../src/modules/check-printing-settings/check-printing-settings.repository.js";

// R-01: every workspace needs check-printing settings (limits and the approval switch).
// They are created lazily, the first time check printing needs them, so a workspace made
// through the API, or one that existed before the settings table, works without repair.

function settingsApi(workspaceId: string, user: TestUser) {
  const base = `/api/v1/workspaces/${workspaceId}/check-printing-settings`;
  const headers = authHeaders(user);
  return {
    get: () => request(getApp()).get(base).set(headers),
    update: (body: Record<string, unknown>) => request(getApp()).put(base).set(headers).send(body),
  };
}

function toggleApproval(workspaceId: string, user: TestUser, body: Record<string, unknown>) {
  return request(getApp())
    .patch(`/api/v1/workspaces/${workspaceId}/approval-rules/settings/approval-toggle`)
    .set(authHeaders(user))
    .send(body);
}

// The path a real customer takes: workspace, bank account and check, all through the API.
async function createWorkspaceThroughApi(user: TestUser): Promise<string> {
  const res = await request(getApp())
    .post("/api/v1/workspaces")
    .set(authHeaders(user))
    .send({
      businessName: "Sunshine Pool Service",
      addressLine1: "12 Lake Road",
      city: "Austin",
      state: "TX",
      zipCode: "78702",
    });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function createBankAccountThroughApi(workspaceId: string, user: TestUser): Promise<string> {
  const res = await request(getApp())
    .post(`/api/v1/workspaces/${workspaceId}/bank-accounts`)
    .set(authHeaders(user))
    .send({
      routingNumber: "026009593",
      accountNumber: "123456785678",
      accountType: "CHECKING",
      startingCheckNumber: 2001,
    });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

function createCheck(workspaceId: string, user: TestUser, bankAccountId: string, amount = 1250.5) {
  return request(getApp())
    .post(`/api/v1/workspaces/${workspaceId}/checks`)
    .set(authHeaders(user))
    .send({ bankAccountId, payeeName: "Hill Country Supply Co.", amount, checkDate: today() });
}

const settingsRows = (workspaceId: string) => prisma.checkPrintingSettings.count({ where: { workspaceId } });

describe("check-printing settings", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("a workspace created through the API", () => {
    it("can write its first check", async () => {
      const workspaceId = await createWorkspaceThroughApi(world.admin);
      const bankAccountId = await createBankAccountThroughApi(workspaceId, world.admin);

      const res = await createCheck(workspaceId, world.admin, bankAccountId);

      expect(res.status).toBe(201);
      expect(res.body.data.checkNumber).toBe(2001);
      expect(await settingsRows(workspaceId)).toBe(1);
    });

    it("starts with the default settings", async () => {
      const workspaceId = await createWorkspaceThroughApi(world.admin);

      const res = await settingsApi(workspaceId, world.admin).get();

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        workspaceId,
        approvalEnabled: false,
        maxCheckAmount: "999999.99",
        maxPastDays: 30,
        maxFutureDays: 90,
        updatedAt: expect.any(String),
      });
    });

    it("can turn the approval workflow on", async () => {
      const workspaceId = await createWorkspaceThroughApi(world.admin);

      const res = await toggleApproval(workspaceId, world.admin, { enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ approvalEnabled: true });
      const settings = await settingsApi(workspaceId, world.admin).get();
      expect(settings.body.data.approvalEnabled).toBe(true);
    });

    it("no longer shows check-printing settings on the workspace itself", async () => {
      const workspaceId = await createWorkspaceThroughApi(world.admin);

      const res = await request(getApp()).get(`/api/v1/workspaces/${workspaceId}`).set(authHeaders(world.admin));

      expect(res.status).toBe(200);
      expect(res.body.data.businessName).toBe("Sunshine Pool Service");
      for (const field of ["approvalEnabled", "maxCheckAmount", "maxPastDays", "maxFutureDays"]) {
        expect(res.body.data).not.toHaveProperty(field);
      }
    });
  });

  describe("a workspace whose settings row is missing (created before the settings table)", () => {
    beforeEach(async () => {
      await prisma.checkPrintingSettings.delete({ where: { workspaceId: world.workspaceId } });
    });

    it("can still write a check, and gets its settings on the way", async () => {
      const res = await createCheck(world.workspaceId, world.editor, world.bankAccountId);

      expect(res.status).toBe(201);
      expect(await settingsRows(world.workspaceId)).toBe(1);
    });

    // Called directly, not over HTTP: the middleware's queries spread HTTP requests apart,
    // so they never land inside the sub-millisecond gap a "find, then create" leaves open.
    // Ten calls started together all send their first query before any finishes, which is
    // exactly the collision a two-step version fails on (verified: it throws P2002).
    it("gets exactly one settings row when many requests ask at the same moment", async () => {
      const repository = new CheckPrintingSettingsRepository();

      const rows = await Promise.all(Array.from({ length: 10 }, () => repository.ensure(world.workspaceId)));

      expect(rows.every((r) => r.workspaceId === world.workspaceId)).toBe(true);
      expect(await settingsRows(world.workspaceId)).toBe(1);
    });
  });

  describe("reading the settings", () => {
    it("is open to every member, because the check form needs the limits", async () => {
      const res = await settingsApi(world.workspaceId, world.viewer).get();

      expect(res.status).toBe(200);
      expect(res.body.data.maxCheckAmount).toBe("50000.00");
    });
  });

  describe("changing the limits", () => {
    it("an admin changes them, and the audit log records old and new values", async () => {
      const res = await settingsApi(world.workspaceId, world.admin).update({ maxCheckAmount: 5000, maxPastDays: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ maxCheckAmount: "5000.00", maxPastDays: 10, maxFutureDays: 90 });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { workspaceId: world.workspaceId, action: "CHECK_PRINTING_SETTINGS_UPDATED" },
      });
      expect(audit.userId).toBe(world.admin.id);
      expect(audit.detailsJson).toEqual({
        changes: {
          maxCheckAmount: { from: "50000.00", to: "5000.00" },
          maxPastDays: { from: 30, to: 10 },
        },
      });
    });

    it("a lowered limit is enforced on the next check", async () => {
      await settingsApi(world.workspaceId, world.admin).update({ maxCheckAmount: 1000 });

      const res = await createCheck(world.workspaceId, world.editor, world.bankAccountId, 1250.5);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/exceeds maximum of \$1,000\.00/);
    });

    it("sending the current values changes nothing and writes no audit row", async () => {
      const res = await settingsApi(world.workspaceId, world.admin).update({ maxCheckAmount: 50000 });

      expect(res.status).toBe(200);
      expect(await prisma.auditLog.count({ where: { action: "CHECK_PRINTING_SETTINGS_UPDATED" } })).toBe(0);
    });

    it("needs the workspace:manage permission", async () => {
      const res = await settingsApi(world.workspaceId, world.editor).update({ maxCheckAmount: 5000 });

      expect(res.status).toBe(403);
      const settings = await prisma.checkPrintingSettings.findUniqueOrThrow({ where: { workspaceId: world.workspaceId } });
      expect(Number(settings.maxCheckAmount)).toBe(50000);
    });

    it.each([
      [{ maxCheckAmount: 1_000_000 }, "maxCheckAmount"],
      [{ maxCheckAmount: 0 }, "maxCheckAmount"],
      [{ maxCheckAmount: 12.345 }, "maxCheckAmount"],
      [{ maxPastDays: -1 }, "maxPastDays"],
      [{ maxPastDays: 1.5 }, "maxPastDays"],
      [{ maxFutureDays: 366 }, "maxFutureDays"],
    ])("refuses %j", async (body, field) => {
      const res = await settingsApi(world.workspaceId, world.admin).update(body);

      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveProperty(field);
    });

    it("points the approval switch to its own endpoint", async () => {
      const res = await settingsApi(world.workspaceId, world.admin).update({ approvalEnabled: true });

      expect(res.status).toBe(400);
      expect(res.body.error.details.approvalEnabled[0]).toMatch(/approval-toggle/);
    });
  });

  describe("the approval switch", () => {
    it.each([[{}], [{ enabled: "yes" }], [{ enabled: null }]])(
      "refuses %j without changing anything or writing an audit row",
      async (body) => {
        const res = await toggleApproval(world.workspaceId, world.admin, body);

        expect(res.status).toBe(400);
        expect(await prisma.auditLog.count({ where: { action: { startsWith: "APPROVAL_WORKFLOW_" } } })).toBe(0);
      },
    );
  });

  describe("the workspace update endpoint", () => {
    it.each(["maxCheckAmount", "maxPastDays", "maxFutureDays", "approvalEnabled"])(
      "refuses %s with a pointer to the settings endpoint instead of crashing",
      async (field) => {
        const value = field === "approvalEnabled" ? true : 10;
        const res = await request(getApp())
          .put(`/api/v1/workspaces/${world.workspaceId}`)
          .set(authHeaders(world.admin))
          .send({ [field]: value });

        expect(res.status).toBe(400);
        expect(res.body.error.details[field][0]).toMatch(/check-printing-settings|approval-toggle/);
      },
    );

    it("still updates the workspace's own fields", async () => {
      const res = await request(getApp())
        .put(`/api/v1/workspaces/${world.workspaceId}`)
        .set(authHeaders(world.admin))
        .send({ businessName: "Green Acres Landscaping & Design LLC" });

      expect(res.status).toBe(200);
      expect(res.body.data.businessName).toBe("Green Acres Landscaping & Design LLC");
    });
  });
});
