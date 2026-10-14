import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { PdfRenderer } from "./pdf.renderer.js";
import { templateForPrinter } from "./pdf.templates.js";
import type { CheckPdfData } from "./pdf.types.js";

// Phase 0.6: a bank account with a signature never produces an unsigned check by
// accident. If the image cannot be drawn, the print fails.

const fontPath = path.resolve(process.env.E13B_FONT_PATH ?? "");
const hasFont = fs.existsSync(fontPath);

// A valid 1×1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function checkData(signatureImagePath: string | null): CheckPdfData {
  return {
    checkNumber: "001001",
    payeeName: "Hill Country Supply Co.",
    amount: "1,250.50",
    amountInWords: "One Thousand Two Hundred Fifty and 50/100",
    checkDate: "10/13/2026",
    memo: "Invoice 4471",
    routingNumber: "111000025",
    accountNumber: "987654321012",
    bankName: "JPMorgan Chase",
    checkNumberPadding: 6,
    companyName: "Green Acres Landscaping LLC",
    companyAddress: "456 Oak Avenue",
    companyCityStateZip: "Austin, TX 78701",
    horizontalOffsetPts: 0,
    verticalOffsetPts: 0,
    signatureImagePath,
    template: templateForPrinter({ paperSize: "A4", stockType: "PLAIN_PAPER" }),
    invoiceItems: null,
  };
}

describe.skipIf(!hasFont)("check signature", () => {
  const renderer = new PdfRenderer(fontPath, { strictFont: false });

  it("refuses to print when the signature file is missing", async () => {
    const missing = path.join(os.tmpdir(), "no-such-signature.png");
    await expect(renderer.render(checkData(missing))).rejects.toMatchObject({
      statusCode: 422,
      code: "SIGNATURE_IMAGE_UNAVAILABLE",
    });
  });

  it("refuses to print when the signature file is not an image", async () => {
    const notImage = path.join(os.tmpdir(), `not-an-image-${process.pid}.png`);
    fs.writeFileSync(notImage, "this is not a PNG");
    try {
      await expect(renderer.render(checkData(notImage))).rejects.toMatchObject({
        code: "SIGNATURE_IMAGE_UNAVAILABLE",
      });
    } finally {
      fs.rmSync(notImage, { force: true });
    }
  });

  it("prints with a valid signature image", async () => {
    const png = path.join(os.tmpdir(), `signature-${process.pid}.png`);
    fs.writeFileSync(png, TINY_PNG);
    try {
      const pdf = await renderer.render(checkData(png));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    } finally {
      fs.rmSync(png, { force: true });
    }
  });

  it("prints without a signature when the account has none", async () => {
    const pdf = await renderer.render(checkData(null));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
