import request from "supertest";
import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createPrinterProfile, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";

// R-03 (decision OD-1): a check needs approval only when the approval workflow is ON and an
// active rule matches its amount. Otherwise a draft prints directly, so a one-person business
// can create and print. Decided at PRINT time: turning approval on later, or editing the amount
// above a rule's threshold, still requires approval.

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

const setApproval = (world: TestWorld, approvalEnabled: boolean) =>
  prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled } });

async function draft(world: TestWorld, user: TestUser, amount = 500): Promise<string> {
  const res = await checksApi(world, user).create({ amount, checkDate: today() });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

describe.skipIf(!hasFont)("printing a draft that needs no approval (R-03)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: false });
    await createPrinterProfile(world);
  });

  describe("with the approval workflow off", () => {
    it("a solo owner creates and prints their own check, nobody else involved", async () => {
      const id = await draft(world, world.admin);
      expect((await checksApi(world, world.admin).get(id)).body.data.status).toBe("NEW");

      const res = await checksApi(world, world.admin).print(id);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PRINTED");
    });

    it("a printer prints an editor's draft directly", async () => {
      const id = await draft(world, world.editor);
      expect((await checksApi(world, world.printer).print(id)).status).toBe(200);
    });

    it("existing rules are ignored while the workflow is off", async () => {
      await createApprovalRule(world, { minAmount: 100 });
      const id = await draft(world, world.editor, 5000);

      expect((await checksApi(world, world.printer).print(id)).status).toBe(200);
    });

    it("records that approval was not required, and why", async () => {
      const id = await draft(world, world.admin);
      await checksApi(world, world.admin).print(id);

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_PRINTED", entityId: id } });
      expect(audit.detailsJson).toMatchObject({ approval: { required: false, reason: "APPROVAL_WORKFLOW_OFF" } });
      const history = await prisma.checkStatusHistory.findFirstOrThrow({ where: { checkId: id, toStatus: "PRINTED" } });
      expect(history.fromStatus).toBe("NEW");
    });
  });

  describe("with the approval workflow on", () => {
    beforeEach(async () => {
      await setApproval(world, true);
      await createApprovalRule(world, { minAmount: 1000 });
    });

    it("a draft below every rule's threshold prints directly", async () => {
      const id = await draft(world, world.editor, 500);

      const res = await checksApi(world, world.printer).print(id);

      expect(res.status).toBe(200);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_PRINTED", entityId: id } });
      expect(audit.detailsJson).toMatchObject({ approval: { required: false, reason: "NO_MATCHING_RULE" } });
    });

    it("a check a rule matches still needs approval (it starts pending)", async () => {
      const id = await draft(world, world.editor, 5000);
      expect((await checksApi(world, world.editor).get(id)).body.data.status).toBe("PENDING_APPROVAL");

      expect((await checksApi(world, world.printer).print(id)).status).toBe(400);
    });

    it("an approved check prints and is recorded as approved", async () => {
      const id = await draft(world, world.editor, 5000);
      expect((await checksApi(world, world.approver1).approve(id)).status).toBe(200);

      expect((await checksApi(world, world.printer).print(id)).status).toBe(200);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_PRINTED", entityId: id } });
      expect(audit.detailsJson).toMatchObject({ approval: { required: true, reason: "APPROVED" } });
    });
  });

  describe("decided at print time, not when the draft was made", () => {
    it("a draft made while approval was off needs approval once a matching rule is switched on", async () => {
      const id = await draft(world, world.editor, 5000);
      await setApproval(world, true);
      await createApprovalRule(world, { minAmount: 1000 });

      const res = await checksApi(world, world.printer).print(id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("APPROVAL_REQUIRED");
      expect(res.body.error.message).toMatch(/\$1,000\.00 and above/);
      expect((await checksApi(world, world.editor).get(id)).body.data.status).toBe("NEW");
    });

    it("a draft edited above a rule's threshold needs approval", async () => {
      await setApproval(world, true);
      await createApprovalRule(world, { minAmount: 1000 });
      const id = await draft(world, world.editor, 500);
      expect((await checksApi(world, world.editor).update(id, { amount: 9000 })).status).toBe(200);

      const res = await checksApi(world, world.printer).print(id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("APPROVAL_REQUIRED");
    });

    it("a refused print leaves no stored PDF behind", async () => {
      await setApproval(world, true);
      await createApprovalRule(world, { minAmount: 1000 });
      const id = await draft(world, world.editor, 500);
      await checksApi(world, world.editor).update(id, { amount: 9000 });

      await checksApi(world, world.printer).print(id);

      const check = await prisma.check.findUniqueOrThrow({ where: { id } });
      expect(check.pdfStorageUrl).toBeNull();
    });
  });
});
