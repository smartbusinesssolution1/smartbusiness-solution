import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createPrinterProfile, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";
import { TEST_STORAGE_PATH } from "../setup/test-env.js";
import { AuditService } from "../../src/shared/services/audit.service.js";

// Phase 0.3: a check PDF is a negotiable instrument. It is stored once per
// successful print, verified on every download, refused once the check is void or
// cleared, and never handed out without an audit record.

const fontPath = path.resolve(process.env.E13B_FONT_PATH ?? "");
const hasFont = fs.existsSync(fontPath);

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function storedPdfs(workspaceId: string): string[] {
  const dir = path.join(TEST_STORAGE_PATH, "checks", workspaceId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

// supertest buffers binary bodies only when asked to.
function binary(res: { body: unknown }): Buffer {
  return res.body as Buffer;
}

describe.skipIf(!hasFont)("check PDF storage and download", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: false });
    await createPrinterProfile(world);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createApprovedCheck(): Promise<string> {
    const created = await checksApi(world, world.editor).create();
    expect(created.status).toBe(201);
    const approved = await checksApi(world, world.approver1).approve(created.body.data.id);
    expect(approved.status).toBe(200);
    return created.body.data.id;
  }

  async function printedCheck(): Promise<string> {
    const id = await createApprovedCheck();
    const printed = await checksApi(world, world.printer).print(id);
    expect(printed.status).toBe(200);
    return id;
  }

  function download(id: string) {
    return checksApi(world, world.printer)
      .pdf(id)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
  }

  it("stores the printed PDF with its SHA-256 and serves exactly those bytes", async () => {
    const id = await printedCheck();

    const check = await prisma.check.findUniqueOrThrow({ where: { id } });
    expect(check.status).toBe("PRINTED");
    expect(check.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(storedPdfs(world.workspaceId)).toHaveLength(1);

    const res = await download(id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(binary(res).subarray(0, 5).toString()).toBe("%PDF-");
    expect(sha256(binary(res))).toBe(check.pdfSha256);
  });

  it("records every download in the audit log", async () => {
    const id = await printedCheck();
    await download(id);
    await download(id);

    const rows = await prisma.auditLog.findMany({ where: { entityId: id, action: "CHECK_PDF_DOWNLOADED" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.userId).toBe(world.printer.id);
  });

  it("refuses the download when the audit record cannot be written", async () => {
    const id = await printedCheck();
    // `write` is private; reach it through an untyped view of the prototype.
    const proto = AuditService.prototype as unknown as { write: () => Promise<void> };
    vi.spyOn(proto, "write").mockRejectedValue(new Error("audit table unavailable"));

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AUDIT_UNAVAILABLE");
  });

  it("refuses to download the PDF of a void check", async () => {
    const id = await printedCheck();
    expect((await checksApi(world, world.admin).void(id)).status).toBe(200);

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHECK_PDF_UNAVAILABLE");
    expect(res.body.error.message).toMatch(/is void/);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "CHECK_PDF_DOWNLOADED" } })).toBe(0);
  });

  it("refuses to download the PDF of a cleared check", async () => {
    const id = await printedCheck();
    await prisma.check.update({ where: { id }, data: { status: "CLEARED" } });

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/cleared the bank/);
  });

  it("refuses a stored PDF that was modified after printing", async () => {
    const id = await printedCheck();
    const [file] = storedPdfs(world.workspaceId);
    const filePath = path.join(TEST_STORAGE_PATH, "checks", world.workspaceId, file!);
    fs.appendFileSync(filePath, "\n% tampered");

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHECK_PDF_INTEGRITY_FAILED");
  });

  it("reports a missing stored PDF as 410 Gone", async () => {
    const id = await printedCheck();
    fs.rmSync(path.join(TEST_STORAGE_PATH, "checks", world.workspaceId), { recursive: true });

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("CHECK_PDF_MISSING");
  });

  it("concurrent prints of one check produce one PRINTED check and one stored PDF", async () => {
    const id = await createApprovedCheck();

    const results = await Promise.all(
      Array.from({ length: 3 }, () => checksApi(world, world.printer).print(id)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);

    // The losers' PDFs are removed, so the only file is the one the check records.
    const files = storedPdfs(world.workspaceId);
    expect(files).toHaveLength(1);
    const check = await prisma.check.findUniqueOrThrow({ where: { id } });
    const bytes = fs.readFileSync(path.join(TEST_STORAGE_PATH, "checks", world.workspaceId, files[0]!));
    expect(sha256(bytes)).toBe(check.pdfSha256);
    expect(check.pdfStorageUrl).toBe(`checks/${world.workspaceId}/${files[0]}`);
  });

  it("never exposes the storage location in API responses", async () => {
    const id = await printedCheck();
    const res = await checksApi(world, world.printer).get(id);

    expect(res.body.data.hasPdf).toBe(true);
    expect(res.body.data).not.toHaveProperty("pdfStorageUrl");
    expect(JSON.stringify(res.body)).not.toContain("checks/");
  });
});
