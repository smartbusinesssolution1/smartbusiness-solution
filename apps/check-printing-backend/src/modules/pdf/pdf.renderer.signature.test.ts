import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { PdfRenderer } from "./pdf.renderer.js";
import { templateForPrinter } from "./pdf.templates.js";
import type { CheckPdfData } from "./pdf.types.js";

// A bank account with a signature never produces an unsigned check by accident: if
// the image cannot be drawn, the print fails.

const fontPath = path.resolve(process.env.E13B_FONT_PATH ?? "");
const hasFont = fs.existsSync(fontPath);

// A valid 1×1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function checkData(signatureImage: Buffer | null): CheckPdfData {
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
    signatureImage,
    template: templateForPrinter({ paperSize: "A4", stockType: "PLAIN_PAPER", layout: "CHECK_MIDDLE" }),
    invoiceItems: null,
  };
}

describe.skipIf(!hasFont)("check signature", () => {
  const renderer = new PdfRenderer(fontPath, { strictFont: false });

  it("refuses to print when the signature bytes are not an image", async () => {
    await expect(renderer.render(checkData(Buffer.from("this is not a PNG")))).rejects.toMatchObject({
      statusCode: 422,
      code: "SIGNATURE_IMAGE_UNAVAILABLE",
    });
  });

  it("embeds a valid signature image in the PDF", async () => {
    const pdf = await renderer.render(checkData(TINY_PNG));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  });

  it("prints a blank signature line when the account has no signature", async () => {
    const pdf = await renderer.render(checkData(null));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
  });
});
