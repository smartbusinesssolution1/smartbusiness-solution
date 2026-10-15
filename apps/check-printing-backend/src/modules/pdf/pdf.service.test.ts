import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash, randomBytes } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PdfService } from "./pdf.service.js";
import type { PdfRenderer } from "./pdf.renderer.js";
import type { CheckPdfData } from "./pdf.types.js";
import { buildKeyring, EncryptedStorage, LocalDiskStorage } from "../../shared/storage/index.js";

// #2: check PDFs are stored encrypted. What sits on disk (or in S3) is never a
// readable check, each print attempt gets its own file, and a modified or missing
// file is never served.

const FAKE_PDF = Buffer.from("%PDF-1.7\nPay to ABC Supplies $4,800.00 987654321012\n%%EOF\n");
const fakeRenderer = { render: async () => FAKE_PDF } as unknown as PdfRenderer;
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("PdfService with encrypted storage", () => {
  let root: string;
  let service: PdfService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-service-test-"));
    const keyring = buildKeyring({ id: "t1", hex: randomBytes(32).toString("hex") });
    service = new PdfService(fakeRenderer, new EncryptedStorage(new LocalDiskStorage(root), keyring));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const generate = (checkId = "check-1") => service.generateCheckPdf({} as CheckPdfData, "ws-1", checkId);

  it("stores the PDF encrypted: the file on disk is not a readable check", async () => {
    const stored = await generate();

    const onDisk = fs.readFileSync(path.join(root, stored.key));
    expect(onDisk.subarray(0, 4).toString()).toBe("SBE1");
    expect(onDisk.toString("latin1")).not.toContain("%PDF");
    expect(onDisk.toString("latin1")).not.toContain("987654321012");
  });

  it("records the SHA-256 of the PDF itself and serves exactly those bytes", async () => {
    const stored = await generate();
    expect(stored.key).toMatch(/^checks\/ws-1\/check-check-1-[0-9a-f-]{36}\.pdf$/);
    expect(stored.sha256).toBe(sha256(FAKE_PDF));
    await expect(service.readVerifiedPdf(stored.key, stored.sha256)).resolves.toEqual(FAKE_PDF);
  });

  it("gives every print attempt of one check its own file", async () => {
    const [a, b] = await Promise.all([generate(), generate()]);
    expect(a.key).not.toBe(b.key);
    expect(fs.readdirSync(path.join(root, "checks", "ws-1"))).toHaveLength(2);
  });

  it("refuses a stored file that was modified", async () => {
    const stored = await generate();
    fs.appendFileSync(path.join(root, stored.key), "tampered");

    await expect(service.readVerifiedPdf(stored.key, stored.sha256)).rejects.toMatchObject({
      statusCode: 409,
      code: "CHECK_PDF_INTEGRITY_FAILED",
    });
  });

  it("refuses a file that decrypts but does not match the recorded SHA-256", async () => {
    const stored = await generate();
    await expect(service.readVerifiedPdf(stored.key, "0".repeat(64))).rejects.toMatchObject({
      code: "CHECK_PDF_INTEGRITY_FAILED",
    });
  });

  it("reports a missing file as 410", async () => {
    const stored = await generate();
    await service.deleteStoredPdf(stored.key);

    await expect(service.readVerifiedPdf(stored.key, stored.sha256)).rejects.toMatchObject({
      statusCode: 410,
      code: "CHECK_PDF_MISSING",
    });
  });

  it("treats an invalid stored key as a server fault, never serving anything", async () => {
    await expect(service.readVerifiedPdf("../../etc/passwd", sha256(FAKE_PDF))).rejects.toMatchObject({
      code: "INVALID_STORAGE_PATH",
      isOperational: false,
    });
  });
});
