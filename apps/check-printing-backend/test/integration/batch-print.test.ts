import * as fs from "fs";
import * as path from "path";
import { createHash, randomUUID } from "crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import {
  authHeaders,
  createApprovalRule,
  createBankAccount,
  createPrinterProfile,
  createWorld,
  type TestUser,
  type TestWorld,
} from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";
import { TEST_STORAGE_PATH } from "../setup/test-env.js";

// ═══════════════════════════════════════════════════════════════
// #7: batch printing. Several checks in one print job, one PDF.
//
//   - All or nothing: if any check can't print, nothing is printed, and the error
//     names every problem by check number.
//   - Check-number order. On three-per-page paper the checks fill the sheet in the
//     tray from its first blank slot, then carry on onto fresh sheets.
//   - Each check keeps its own PDF; the job's PDF is handed out only while every
//     check in it is still PRINTED.
//   - The printer remembers the next blank slot, for single prints too.
// ═══════════════════════════════════════════════════════════════

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

let world: TestWorld;
let a4Profile: string;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
  a4Profile = await createPrinterProfile(world);
});

const base = () => `/api/v1/workspaces/${world.workspaceId}`;

function printBatch(body: Record<string, unknown>, user: TestUser = world.printer, idempotencyKey?: string) {
  const req = request(getApp()).post(`${base()}/checks/print-batches`).set(authHeaders(user));
  if (idempotencyKey) req.set("Idempotency-Key", idempotencyKey);
  return req.send(body);
}

const getBatch = (id: string) => request(getApp()).get(`${base()}/checks/print-batches/${id}`).set(authHeaders(world.printer));

function downloadBatch(id: string) {
  return request(getApp())
    .get(`${base()}/checks/print-batches/${id}/pdf`)
    .set(authHeaders(world.printer))
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
}

async function threePerPageProfile(): Promise<string> {
  const res = await request(getApp())
    .post(`${base()}/calibration`)
    .set(authHeaders(world.printer))
    .send({
      profileName: "Front desk - 3 per page",
      paperSize: "LETTER",
      layout: "THREE_PER_PAGE",
      measurements: { unit: "in", sheets: Array(3).fill({ x1: 1, x2: 7.5, y1: 1, y2: 10 }) },
    });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

const profile = async (id: string) =>
  (await request(getApp()).get(`${base()}/calibration/${id}`).set(authHeaders(world.printer))).body.data;

// With the approval workflow off, a new check needs no approval and is printable.
async function printable(count: number, body: Record<string, unknown> = {}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const res = await checksApi(world, world.editor).create({ payeeName: `Payee ${i + 1}`, ...body });
    expect(res.status).toBe(201);
    ids.push(res.body.data.id);
  }
  return ids;
}

const stored = (id: string) => prisma.check.findUniqueOrThrow({ where: { id } });
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const pageCount = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

function storedFiles(workspaceId: string) {
  const dir = path.join(TEST_STORAGE_PATH, "checks", workspaceId);
  const files = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".pdf")) : []);
  return { checks: files(dir), batches: files(path.join(dir, "batches")) };
}

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("printing several checks in one job", () => {
  it("three per page from the middle slot: check-number order, slots 2-3 then a fresh sheet", async () => {
    const profileId = await threePerPageProfile();
    const ids = await printable(4);

    // Sent in reverse; printed in check-number order regardless.
    const res = await printBatch({ checkIds: [...ids].reverse(), calibrationProfileId: profileId, startPosition: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.batch).toMatchObject({ checkCount: 4, sheetCount: 2, layout: "THREE_PER_PAGE", startPosition: 2, nextPosition: 3 });
    expect(res.body.data.checks.map((c: { checkNumber: number }) => c.checkNumber)).toEqual([1001, 1002, 1003, 1004]);
    expect(res.body.data.checks.map((c: { printSnapshot: { position: number }; sheet: number }) => [c.sheet, c.printSnapshot.position])).toEqual([
      [1, 2],
      [1, 3],
      [2, 1],
      [2, 2],
    ]);

    for (const id of ids) {
      const c = await stored(id);
      expect(c.status).toBe("PRINTED");
      expect(c.printBatchId).toBe(res.body.data.batch.id);
      expect(c.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    }

    // The job's PDF: one page per sheet, exactly the bytes recorded on the batch.
    const pdf = await downloadBatch(res.body.data.batch.id);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    const bytes = pdf.body as Buffer;
    expect(pageCount(bytes)).toBe(2);
    const batch = await prisma.printBatch.findUniqueOrThrow({ where: { id: res.body.data.batch.id } });
    expect(sha256(bytes)).toBe(batch.pdfSha256);

    // Each check still has its own one-page PDF.
    const single = await checksApi(world, world.printer).pdf(ids[2]!);
    expect(single.status).toBe(200);

    // The printer now expects the bottom slot of the half-used sheet.
    expect((await profile(profileId)).nextSlot).toBe(3);
    // One file per check plus the job's.
    expect(storedFiles(world.workspaceId)).toMatchObject({ checks: expect.any(Array), batches: [expect.any(String)] });
    expect(storedFiles(world.workspaceId).checks).toHaveLength(4);
  });

  it("paper with one check per sheet: one page per check, no slots", async () => {
    const ids = await printable(3);
    const res = await printBatch({ checkIds: ids, calibrationProfileId: a4Profile });
    expect(res.status).toBe(201);
    expect(res.body.data.batch).toMatchObject({ checkCount: 3, sheetCount: 3, startPosition: null, nextPosition: null, paperSize: "A4" });
    expect(pageCount((await downloadBatch(res.body.data.batch.id)).body as Buffer)).toBe(3);
    for (const id of ids) expect((await stored(id)).printPosition).toBeNull();
  });

  it("uses the workspace's default printer when none is chosen", async () => {
    const res = await printBatch({ checkIds: await printable(2) });
    expect(res.status).toBe(201);
    expect(res.body.data.batch.calibrationProfileId).toBe(a4Profile);
  });

  it("refuses a start slot on paper with one check per sheet", async () => {
    const ids = await printable(2);
    const res = await printBatch({ checkIds: ids, calibrationProfileId: a4Profile, startPosition: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.startPosition).toBeDefined();
    expect((await stored(ids[0]!)).status).toBe("NEW");
  });

  it("records history and audit for every check, and one audit entry for the job", async () => {
    const ids = await printable(2);
    const res = await printBatch({ checkIds: ids });
    expect(res.status).toBe(201);
    const batchId = res.body.data.batch.id;

    for (const id of ids) {
      const history = await prisma.checkStatusHistory.findFirstOrThrow({ where: { checkId: id, toStatus: "PRINTED" } });
      expect(history).toMatchObject({ fromStatus: "NEW", changeById: world.printer.id });
    }
    const printed = await prisma.auditLog.findMany({ where: { action: "CHECK_PRINTED" } });
    expect(printed.map((a) => a.entityId).sort()).toEqual([...ids].sort());
    expect(printed.every((a) => (a.detailsJson as { printBatchId: string }).printBatchId === batchId)).toBe(true);
    const job = await prisma.auditLog.findFirstOrThrow({ where: { action: "PRINT_BATCH_CREATED" } });
    expect(job.entityId).toBe(batchId);
    expect((job.detailsJson as { checkNumbers: number[] }).checkNumbers).toEqual([1001, 1002]);
  });

  it("says once which checks' invoice lines were not printed on stub-less paper", async () => {
    const profileId = await threePerPageProfile();
    const [plain] = await printable(1);
    const [withLines] = await printable(1, { amount: 300, invoiceItems: [{ description: "INV-1", amount: 300 }] });
    const res = await printBatch({ checkIds: [plain, withLines], calibrationProfileId: profileId });
    expect(res.status).toBe(201);
    expect(res.body.data.notice).toMatch(/invoice lines of #1002 were not printed/);
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("all or nothing", () => {
  it("one void and one needing approval: nothing prints, and both are named", async () => {
    const [ok, toVoid] = await printable(2);
    // A draft is deleted, not voided: approve it, then void it.
    expect((await checksApi(world, world.approver1).approve(toVoid!)).status).toBe(200);
    expect((await checksApi(world, world.admin).void(toVoid!, "Duplicate")).status).toBe(200);
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { minAmount: 5000, approvers: [world.approver1] });
    const [big] = await printable(1, { amount: 9000, saveAsDraft: true });

    const res = await printBatch({ checkIds: [ok, toVoid, big] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/2 of the 3 checks can't be printed, so nothing was printed/);
    expect(res.body.error.details[toVoid!][0]).toMatch(/#1002 is void/);
    expect(res.body.error.details[big!][0]).toMatch(/#1003 needs approval/);
    expect(res.body.error.details[ok!]).toBeUndefined();

    expect((await stored(ok!)).status).toBe("NEW");
    expect(await prisma.printBatch.count()).toBe(0);
    expect(storedFiles(world.workspaceId)).toEqual({ checks: [], batches: [] });
  });

  it("a check from an inactive bank account stops the whole job", async () => {
    const [ok] = await printable(1);
    const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 5001 });
    const res0 = await checksApi(world, world.editor).create({ bankAccountId: other });
    expect(res0.status).toBe(201);
    await prisma.bankAccount.update({ where: { id: other }, data: { isActive: false } });

    const res = await printBatch({ checkIds: [ok, res0.body.data.id] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[res0.body.data.id][0]).toMatch(/inactive/);
    expect((await stored(ok!)).status).toBe("NEW");
    expect(storedFiles(world.workspaceId)).toEqual({ checks: [], batches: [] });
  });

  it("a check of another workspace is not found, and nothing prints", async () => {
    const [ok] = await printable(1);
    const otherWorld = await createWorld({ approvalEnabled: false });
    const foreign = await checksApi(otherWorld, otherWorld.editor).create();
    expect(foreign.status).toBe(201);

    const res = await printBatch({ checkIds: [ok, foreign.body.data.id] });
    expect(res.status).toBe(404);
    expect((await stored(ok!)).status).toBe("NEW");
    expect((await stored(foreign.body.data.id)).status).toBe("NEW");
  });

  it("two jobs racing for the same check: one prints it, the other prints nothing and leaves no files", async () => {
    const [shared, a, b] = await printable(3);
    const results = await Promise.all([printBatch({ checkIds: [shared, a] }), printBatch({ checkIds: [shared, b] })]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    // The loser either saw the check already printed (400) or lost the final UPDATE (409).
    expect(statuses.filter((s) => s === 400 || s === 409)).toHaveLength(1);

    const winner = results.find((r) => r.status === 201)!;
    const loserOnly = winner.body.data.checks.some((c: { id: string }) => c.id === a) ? b : a;
    expect((await stored(loserOnly!)).status).toBe("NEW");
    expect(await prisma.printBatch.count()).toBe(1);
    expect(await prisma.checkStatusHistory.count({ where: { checkId: shared, toStatus: "PRINTED" } })).toBe(1);
    // Only the winner's files remain: two check PDFs and one job PDF.
    expect(storedFiles(world.workspaceId).checks).toHaveLength(2);
    expect(storedFiles(world.workspaceId).batches).toHaveLength(1);
  });

  it("a retry with the same Idempotency-Key returns the same job instead of printing again", async () => {
    const ids = await printable(2);
    const key = randomUUID();
    const first = await printBatch({ checkIds: ids }, world.printer, key);
    const retry = await printBatch({ checkIds: ids }, world.printer, key);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.body.data.batch.id).toBe(first.body.data.batch.id);
    expect(await prisma.printBatch.count()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
describe("request rules", () => {
  it.each([
    ["no checks", { checkIds: [] }],
    ["a duplicate", { checkIds: ["7c1e0b8e-4d7a-4b5e-9c1f-0a1b2c3d4e5f", "7c1e0b8e-4d7a-4b5e-9c1f-0a1b2c3d4e5f"] }],
    ["more than 30", { checkIds: Array.from({ length: 31 }, () => randomUUID()) }],
    ["a malformed id", { checkIds: ["not-a-uuid"] }],
    ["slot 4", { checkIds: [randomUUID()], startPosition: 4 }],
  ])("rejects %s", async (_label, body) => {
    const res = await printBatch(body);
    expect(res.status).toBe(400);
  });

  it("needs the print permission", async () => {
    const ids = await printable(1);
    const res = await printBatch({ checkIds: ids }, world.viewer);
    expect(res.status).toBe(403);
    expect((await stored(ids[0]!)).status).toBe("NEW");
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("after the job: outcomes and the job's PDF", () => {
  it("each check is confirmed or spoiled on its own; a spoiled check withdraws the job's PDF", async () => {
    const ids = await printable(3);
    const res = await printBatch({ checkIds: ids });
    const batchId = res.body.data.batch.id;

    expect((await getBatch(batchId)).body.data).toMatchObject({ checkCount: 3, pdfAvailable: true });

    expect((await checksApi(world, world.printer).printOutcome(ids[0]!, { outcome: "OK" })).status).toBe(200);
    expect((await downloadBatch(batchId)).status).toBe(200);

    const spoiled = await checksApi(world, world.printer).printOutcome(ids[1]!, { outcome: "SPOILED", reason: "Jammed" });
    expect(spoiled.status).toBe(200);

    const after = await getBatch(batchId);
    expect(after.body.data.pdfAvailable).toBe(false);
    expect(after.body.data.checks.map((c: { status: string }) => c.status)).toEqual(["PRINTED", "VOID", "PRINTED"]);

    // Printing the job's PDF again would duplicate check #1002, so it is refused...
    const refused = await request(getApp()).get(`${base()}/checks/print-batches/${batchId}/pdf`).set(authHeaders(world.printer));
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("PRINT_BATCH_PDF_UNAVAILABLE");
    expect(refused.body.error.message).toMatch(/#1002 is void/);
    // ...while the checks still printed can each be downloaded on their own.
    expect((await checksApi(world, world.printer).pdf(ids[2]!)).status).toBe(200);
  });

  it("audits every download of the job's PDF", async () => {
    const res = await printBatch({ checkIds: await printable(2) });
    expect((await downloadBatch(res.body.data.batch.id)).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PRINT_BATCH_PDF_DOWNLOADED" } });
    expect(audit.entityId).toBe(res.body.data.batch.id);
  });

  it("a print job of another workspace is not found", async () => {
    const res = await printBatch({ checkIds: await printable(1) });
    const otherWorld = await createWorld({ approvalEnabled: false });
    const foreign = await request(getApp())
      .get(`/api/v1/workspaces/${otherWorld.workspaceId}/checks/print-batches/${res.body.data.batch.id}`)
      .set(authHeaders(otherWorld.printer));
    expect(foreign.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("the printer remembers the next blank slot", () => {
  it("advances after single prints: slot 1 then 2, slot 3 wraps to a fresh sheet", async () => {
    const profileId = await threePerPageProfile();
    expect((await profile(profileId)).nextSlot).toBe(1);
    const [first, second] = await printable(2);
    const print = (id: string, position: number) =>
      request(getApp())
        .post(`${base()}/checks/${id}/print`)
        .set(authHeaders(world.printer))
        .send({ calibrationProfileId: profileId, position });

    expect((await print(first!, 1)).status).toBe(200);
    expect((await profile(profileId)).nextSlot).toBe(2);
    expect((await print(second!, 3)).status).toBe(200);
    expect((await profile(profileId)).nextSlot).toBe(1);
  });

  it("is always 1 for paper with one check per sheet", async () => {
    await printBatch({ checkIds: await printable(2) });
    expect((await profile(a4Profile)).nextSlot).toBe(1);
  });
});
