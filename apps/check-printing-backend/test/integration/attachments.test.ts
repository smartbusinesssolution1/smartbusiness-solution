import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";
import { TEST_STORAGE_PATH } from "../setup/test-env.js";
import { AttachmentRepository } from "../../src/modules/check/attachment.repository.js";

// #4: invoices and receipts attached to checks: the evidence an approver checks.

let world: TestWorld;
let checkId: string;

const base = () => `/api/v1/workspaces/${world.workspaceId}/checks/${checkId}/attachments`;

// A PDF of about `kb` kilobytes (valid enough for a type check; content is opaque to us).
const pdfOf = (kb = 2) => Buffer.concat([Buffer.from("%PDF-1.7\n% invoice\n"), Buffer.alloc(kb * 1024, 0x20), Buffer.from("\n%%EOF\n")]);

function upload(user: TestUser, file: Buffer | null, name = "invoice_sept.pdf") {
  const req = request(getApp()).post(base()).set(authHeaders(user));
  if (file) req.attach("file", file, { filename: name, contentType: "application/octet-stream" });
  else req.field("nothing", "here");
  return req;
}

const download = (user: TestUser, attachmentId: string) =>
  request(getApp())
    .get(`${base()}/${attachmentId}`)
    .set(authHeaders(user))
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });

const remove = (user: TestUser, attachmentId: string) =>
  request(getApp()).delete(`${base()}/${attachmentId}`).set(authHeaders(user));

const storedFiles = () => {
  const dir = path.join(TEST_STORAGE_PATH, "attachments", world.workspaceId, checkId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
  const created = await checksApi(world, world.editor).create();
  checkId = created.body.data.id;
});

describe("adding attachments", () => {
  it("the creator attaches an invoice; it appears on the check", async () => {
    const res = await upload(world.editor, pdfOf(), "invoice_sept.pdf");

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ fileName: "invoice_sept.pdf", fileType: "application/pdf" });
    expect(res.body.data.sizeBytes).toBe(pdfOf().length);

    const check = await checksApi(world, world.editor).get(checkId);
    expect(check.body.data.attachments).toEqual([expect.objectContaining({ id: res.body.data.id, fileName: "invoice_sept.pdf" })]);
    expect(await prisma.auditLog.count({ where: { action: "CHECK_ATTACHMENT_ADDED" } })).toBe(1);
  });

  it("stores it encrypted under a random name, never the user's file name", async () => {
    await upload(world.editor, pdfOf(), "secret-salary-list.pdf");
    const [file] = storedFiles();
    expect(file).toMatch(/^[0-9a-f-]{36}$/);
    const onDisk = fs.readFileSync(path.join(TEST_STORAGE_PATH, "attachments", world.workspaceId, checkId, file!));
    expect(onDisk.subarray(0, 4).toString()).toBe("SBE1");
    expect(onDisk.toString("latin1")).not.toContain("%PDF");
  });

  it("re-encodes photos, dropping camera metadata", async () => {
    const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#f0f0f0" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo", Model: "Receipt Cam" } })
      .toBuffer();
    const res = await upload(world.editor, photo, "receipt.jpeg");
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ fileName: "receipt.jpg", fileType: "image/jpeg" });

    const file = await download(world.editor, res.body.data.id);
    expect((await sharp(file.body as Buffer).metadata()).exif).toBeUndefined();
  });

  it("cleans a dangerous file name for display", async () => {
    const res = await upload(world.editor, pdfOf(), '../../x"y.pdf');
    expect(res.body.data.fileName).toBe("x y.pdf");
  });

  it.each([
    ["an HTML page", Buffer.from("<html><script>alert(1)</script></html>"), "invoice.pdf"],
    ["an SVG image", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), "logo.svg"],
    ["a Word file", Buffer.from("PK\u0003\u0004 word/document.xml"), "invoice.docx"],
    ["a program", Buffer.from("MZ\u0090\u0000 this program cannot be run in DOS mode"), "invoice.exe"],
  ])("refuses %s, whatever it is called", async (_label, bytes, name) => {
    const res = await upload(world.editor, bytes, name);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(storedFiles()).toHaveLength(0);
  });

  it("refuses a request without a file", async () => {
    const res = await upload(world.editor, null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FILE");
  });

  it("cuts off a file over 10 MB", async () => {
    const res = await upload(world.editor, pdfOf(10 * 1024 + 1));
    expect(res.status).toBe(413);
  });

  it("allows at most 25 MB per check", async () => {
    expect((await upload(world.editor, pdfOf(9 * 1024))).status).toBe(201);
    expect((await upload(world.editor, pdfOf(9 * 1024))).status).toBe(201);
    const third = await upload(world.editor, pdfOf(9 * 1024));
    expect(third.status).toBe(413);
    expect(third.body.error.code).toBe("ATTACHMENTS_TOO_LARGE");
    expect(storedFiles()).toHaveLength(2); // the refused file was cleaned up
  });

  it("allows at most 10 files per check", async () => {
    for (let i = 0; i < 10; i++) expect((await upload(world.editor, pdfOf(1))).status).toBe(201);
    const eleventh = await upload(world.editor, pdfOf(1));
    expect(eleventh.status).toBe(422);
    expect(eleventh.body.error.code).toBe("TOO_MANY_ATTACHMENTS");
  });

  it("simultaneous claims at the database step: only as many as fit under 25 MB succeed", async () => {
    // Fired straight at the locked database step, so all six really collide (through
    // HTTP, storing each file first spreads them out and hides a missing lock).
    const repo = new AttachmentRepository();
    const nineMb = 9 * 1024 * 1024;
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        repo.add(checkId, world.workspaceId, world.editor.id, {
          fileName: `invoice-${i}.pdf`,
          fileType: "application/pdf",
          fileSizeBytes: nineMb,
          storageKey: `attachments/${world.workspaceId}/${checkId}/claim-${i}`,
          sha256: "0".repeat(64),
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const total = await prisma.checkAttachment.aggregate({ where: { checkId }, _sum: { fileSizeBytes: true } });
    expect(Number(total._sum.fileSizeBytes)).toBeLessThanOrEqual(25 * 1024 * 1024);
  });

  it("two uploads at the same moment cannot both slip under the 25 MB limit", async () => {
    expect((await upload(world.editor, pdfOf(9 * 1024))).status).toBe(201);
    const [a, b] = await Promise.all([upload(world.editor, pdfOf(9 * 1024)), upload(world.editor, pdfOf(9 * 1024))]);

    expect([a.status, b.status].sort()).toEqual([201, 413]);
    expect(await prisma.checkAttachment.count({ where: { checkId } })).toBe(2);
    expect(storedFiles()).toHaveLength(2);
  });

  it("only the check's creator can add attachments", async () => {
    const res = await upload(world.admin, pdfOf());
    expect(res.status).toBe(403);
  });

  it("people who cannot create checks are refused before the upload is read", async () => {
    for (const user of [world.viewer, world.approver1, world.printer]) {
      expect((await upload(user, pdfOf())).status).toBe(403);
    }
  });
});

describe("attachments freeze once the check is submitted", () => {
  beforeEach(async () => {
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { approvers: [world.approver1] });
  });

  it("no adding or removing while it waits for approval, so the approver sees what was submitted", async () => {
    const added = await upload(world.editor, pdfOf());
    await checksApi(world, world.editor).submit(checkId);

    const add = await upload(world.editor, pdfOf());
    expect(add.status).toBe(409);
    expect(add.body.error.message).toMatch(/already submitted/);
    expect((await remove(world.editor, added.body.data.id)).status).toBe(409);
    expect(await prisma.checkAttachment.count({ where: { checkId } })).toBe(1);
  });

  it("after a rejection the creator can fix the evidence again", async () => {
    await checksApi(world, world.editor).submit(checkId);
    await checksApi(world, world.approver1).reject(checkId, "Attach the invoice");

    expect((await upload(world.editor, pdfOf())).status).toBe(201);
  });
});

describe("viewing attachments", () => {
  let attachmentId: string;

  beforeEach(async () => {
    attachmentId = (await upload(world.editor, pdfOf(), "invoice_sept.pdf")).body.data.id;
  });

  it("an approver downloads the exact file, as a file to save, and the download is recorded", async () => {
    const res = await download(world.approver1, attachmentId);

    expect(res.status).toBe(200);
    expect((res.body as Buffer).equals(pdfOf())).toBe(true);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="invoice_sept.pdf"/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBe("sandbox; default-src 'none'");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(await prisma.auditLog.count({ where: { action: "CHECK_ATTACHMENT_DOWNLOADED", userId: world.approver1.id } })).toBe(1);
  });

  it("anyone who can see the check can list its attachments", async () => {
    const res = await request(getApp()).get(base()).set(authHeaders(world.viewer));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("refuses a stored file that was modified", async () => {
    const [file] = storedFiles();
    fs.appendFileSync(path.join(TEST_STORAGE_PATH, "attachments", world.workspaceId, checkId, file!), "tampered");
    const res = await request(getApp()).get(`${base()}/${attachmentId}`).set(authHeaders(world.approver1));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ATTACHMENT_INTEGRITY_FAILED");
  });

  it("another company cannot reach it", async () => {
    const other = await createWorld();
    const res = await request(getApp()).get(`${base()}/${attachmentId}`).set(authHeaders(other.admin));
    expect(res.status).toBe(404);
  });
});

describe("removing attachments", () => {
  it("removing from a draft deletes the row and the file; the audit keeps its name and fingerprint", async () => {
    const added = await upload(world.editor, pdfOf(), "wrong-invoice.pdf");
    const res = await remove(world.editor, added.body.data.id);

    expect(res.status).toBe(204);
    expect(await prisma.checkAttachment.count()).toBe(0);
    expect(storedFiles()).toHaveLength(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_ATTACHMENT_REMOVED" } });
    expect(audit.detailsJson).toMatchObject({ fileName: "wrong-invoice.pdf", fileDeleted: true });
  });
});

describe("reissue carries the evidence", () => {
  it("the replacement check gets the same attachments; removing them there keeps the original's file", async () => {
    const original = (await upload(world.editor, pdfOf(), "invoice_sept.pdf")).body.data;
    await checksApi(world, world.approver1).approve(checkId);
    await checksApi(world, world.admin).void(checkId, "Wrong amount");
    const originalCheckId = checkId;

    const reissued = await checksApi(world, world.editor).reissue(originalCheckId);
    expect(reissued.status).toBe(201);
    expect(reissued.body.data.attachments).toEqual([expect.objectContaining({ fileName: "invoice_sept.pdf" })]);

    // On the new (draft) check, the creator removes the copied attachment...
    checkId = reissued.body.data.id;
    const copyId = reissued.body.data.attachments[0].id;
    const removed = await remove(world.editor, copyId);
    expect(removed.status).toBe(204);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_ATTACHMENT_REMOVED" } });
    expect(audit.detailsJson).toMatchObject({ fileDeleted: false });

    // ...and the voided original still has its evidence.
    checkId = originalCheckId;
    const res = await download(world.admin, original.id);
    expect(res.status).toBe(200);
    expect((res.body as Buffer).equals(pdfOf())).toBe(true);
  });
});
