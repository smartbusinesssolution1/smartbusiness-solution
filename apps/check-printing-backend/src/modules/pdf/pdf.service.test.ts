import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PdfService, assertInside } from "./pdf.service.js";
import type { PdfRenderer } from "./pdf.renderer.js";
import type { CheckPdfData } from "./pdf.types.js";

// Phase 0.3 and 0.7: stored PDFs never escape the storage root, each print attempt
// gets its own file, and a modified file is never served.

const FAKE_PDF = Buffer.from("%PDF-1.7\nfake check\n%%EOF\n");
const fakeRenderer = { render: async () => FAKE_PDF } as unknown as PdfRenderer;
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("assertInside", () => {
  const root = path.resolve("/srv/uploads");

  it("accepts paths inside the root", () => {
    expect(() => assertInside(root, path.join(root, "checks", "a.pdf"))).not.toThrow();
  });

  it.each([
    ["the root itself", root],
    ["a parent traversal", path.join(root, "..", "secrets.pdf")],
    ["a sibling sharing the root's prefix", path.resolve("/srv/uploads-old/a.pdf")],
    ["an unrelated absolute path", path.resolve("/etc/passwd")],
  ])("rejects %s", (_label, target) => {
    expect(() => assertInside(root, target)).toThrow(expect.objectContaining({ code: "INVALID_STORAGE_PATH" }));
  });
});

describe("PdfService storage", () => {
  let root: string;
  let service: PdfService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-service-test-"));
    service = new PdfService(fakeRenderer, root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const generate = (checkId = "check-1") => service.generateCheckPdf({} as CheckPdfData, "ws-1", checkId);

  it("stores under a relative key with the PDF's SHA-256", async () => {
    const stored = await generate();

    expect(stored.key).toMatch(/^checks\/ws-1\/check-check-1-[0-9a-f-]{36}\.pdf$/);
    expect(stored.sha256).toBe(sha256(FAKE_PDF));
    expect(fs.readFileSync(path.join(root, stored.key))).toEqual(FAKE_PDF);
  });

  it("gives every print attempt of one check its own file", async () => {
    const [a, b] = await Promise.all([generate(), generate()]);
    expect(a.key).not.toBe(b.key);
    expect(fs.readdirSync(path.join(root, "checks", "ws-1"))).toHaveLength(2);
  });

  it("serves a stored PDF whose hash matches", async () => {
    const stored = await generate();
    await expect(service.readVerifiedPdf(stored.key, stored.sha256)).resolves.toEqual(FAKE_PDF);
  });

  it("refuses a stored PDF that was modified", async () => {
    const stored = await generate();
    fs.appendFileSync(path.join(root, stored.key), "tampered");

    await expect(service.readVerifiedPdf(stored.key, stored.sha256)).rejects.toMatchObject({
      statusCode: 409,
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

  it.each(["../outside.pdf", "checks/../../outside.pdf", path.resolve("/etc/passwd")])(
    "refuses a key that escapes the storage root: %s",
    async (key) => {
      fs.writeFileSync(path.join(root, "..", "outside.pdf"), FAKE_PDF);
      await expect(service.readVerifiedPdf(key, sha256(FAKE_PDF))).rejects.toMatchObject({
        code: "INVALID_STORAGE_PATH",
      });
      await expect(service.deleteStoredPdf(key)).rejects.toMatchObject({ code: "INVALID_STORAGE_PATH" });
    },
  );

  it("refuses a symlink inside the storage root that points outside it", async () => {
    const outside = path.join(os.tmpdir(), `outside-${process.pid}.pdf`);
    fs.writeFileSync(outside, FAKE_PDF);
    fs.mkdirSync(path.join(root, "checks"), { recursive: true });
    try {
      try {
        fs.symlinkSync(outside, path.join(root, "checks", "link.pdf"));
      } catch {
        return; // Creating symlinks needs extra privileges on Windows; covered on Linux CI.
      }
      await expect(service.readVerifiedPdf("checks/link.pdf", sha256(FAKE_PDF))).rejects.toMatchObject({
        code: "INVALID_STORAGE_PATH",
      });
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
