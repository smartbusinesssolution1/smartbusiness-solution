import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

// A check that needs approval used to go straight to PENDING_APPROVAL when created, and
// attachments freeze at that moment: its invoice could never be attached. Now the app can
// save it as a draft, attach the invoice, then submit it.

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: true });
  await createApprovalRule(world, { minAmount: 1000, approvers: [world.approver1] });
});

const pdf = () => Buffer.concat([Buffer.from("%PDF-1.7\n% invoice\n"), Buffer.alloc(2048, 0x20), Buffer.from("\n%%EOF\n")]);

const attach = (checkId: string) =>
  request(getApp())
    .post(`/api/v1/workspaces/${world.workspaceId}/checks/${checkId}/attachments`)
    .set(authHeaders(world.editor))
    .attach("file", pdf(), { filename: "INV-2231.pdf", contentType: "application/pdf" });

describe("save as draft, attach the invoice, then submit", () => {
  it("keeps a check that needs approval as a draft, and says it needs approval", async () => {
    const res = await checksApi(world, world.editor).create({ amount: 2500, saveAsDraft: true });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("NEW");
    expect(res.body.data.approvalRequired).toBe(true);
  });

  it("the approver sees the invoice that was attached before submission, and it is then frozen", async () => {
    const api = checksApi(world, world.editor);
    const id = (await api.create({ amount: 2500, saveAsDraft: true })).body.data.id;

    expect((await attach(id)).status).toBe(201);
    const submitted = await api.submit(id);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe("PENDING_APPROVAL");

    const queue = await checksApi(world, world.approver1).approvalQueue();
    expect(queue.body.data.map((c: { id: string }) => c.id)).toContain(id);
    const seen = await checksApi(world, world.approver1).get(id);
    expect(seen.body.data.attachments.map((a: { fileName: string }) => a.fileName)).toEqual(["INV-2231.pdf"]);

    // Evidence is frozen once submitted.
    expect((await attach(id)).status).toBeGreaterThanOrEqual(400);
  });

  it("a draft that needs approval still cannot be printed", async () => {
    const id = (await checksApi(world, world.editor).create({ amount: 2500, saveAsDraft: true })).body.data.id;
    const res = await checksApi(world, world.printer).print(id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("APPROVAL_REQUIRED");
  });

  it("without saveAsDraft, creation still routes straight to approval as before", async () => {
    const res = await checksApi(world, world.editor).create({ amount: 2500 });
    expect(res.body.data.status).toBe("PENDING_APPROVAL");
    expect(res.body.data.approvalRequired).toBeNull();
  });
});

describe("approvalRequired on a draft follows the rules", () => {
  it("is false under every rule's minimum, and true after an edit moves the amount into a rule", async () => {
    const api = checksApi(world, world.editor);
    const created = await api.create({ amount: 400, saveAsDraft: true });
    expect(created.body.data.approvalRequired).toBe(false);

    const edited = await api.update(created.body.data.id, { amount: 1500 });
    expect(edited.status).toBe(200);
    expect(edited.body.data.approvalRequired).toBe(true);
    expect((await api.get(created.body.data.id)).body.data.approvalRequired).toBe(true);
  });

  it("is false when the approval workflow is switched off", async () => {
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: false } });
    const res = await checksApi(world, world.editor).create({ amount: 2500, saveAsDraft: true });
    expect(res.body.data.approvalRequired).toBe(false);
  });
});

describe("submitting a check that needs no approval", () => {
  it("is refused, because no approver would ever see it", async () => {
    const api = checksApi(world, world.editor);
    const id = (await api.create({ amount: 400 })).body.data.id;
    const res = await api.submit(id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("APPROVAL_NOT_REQUIRED");
    expect((await prisma.check.findUniqueOrThrow({ where: { id } })).status).toBe("NEW");
  });
});
