import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfRenderer } from "./pdf.renderer.js";
import { templateForPrinter } from "./pdf.templates.js";
import { MICR, MICR_CHARS, MICR_FIELD_END_POSITION, PTS_PER_INCH } from "./pdf.types.js";
import type { CheckPdfData, PaperSize } from "./pdf.types.js";

// MICR line placement per ANSI X9.100-160-1, checked on the drawing commands the
// renderer issues (points, origin top-left, before the printer offset is applied):
//   - baseline 3/16" above the check's bottom edge
//   - position 1 is 5/16" from the right edge; each character is 1/8" (9 pt)
//   - on-us ends at position 14, transit occupies 33–43, aux on-us ends at 45
//   - positions 1–12 (the bank's amount field) stay blank
//   - nothing but MICR ink in the clear band, the bottom 5/8" of the check

const fontPath = path.resolve(process.env.E13B_FONT_PATH ?? "");
const hasFont = fs.existsSync(fontPath);

interface TextCall {
  text: string;
  x: number;
  y: number;
  font: string;
  fontSize: number;
  baseline?: string;
}

const PITCH = MICR.pitchPts;
const { transit: T, onUs: O } = MICR_CHARS;

function data(paperSize: PaperSize, overrides: Partial<CheckPdfData> = {}): CheckPdfData {
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
    signatureImagePath: null,
    template: templateForPrinter({ paperSize, stockType: "PLAIN_PAPER" }),
    invoiceItems: null,
    ...overrides,
  };
}

describe.skipIf(!hasFont)("MICR line geometry", () => {
  const renderer = new PdfRenderer(fontPath, { strictFont: false });
  let calls: TextCall[];
  let translations: Array<[number, number]>;

  beforeEach(() => {
    calls = [];
    translations = [];
    const proto = PDFDocument.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const originalText = proto.text!;
    const originalTranslate = proto.translate!;
    const originalFont = proto.font!;
    let currentFont = "Helvetica";
    vi.spyOn(proto, "font").mockImplementation(function (this: unknown, ...args: unknown[]) {
      if (typeof args[0] === "string") currentFont = args[0];
      return originalFont.apply(this, args);
    });
    vi.spyOn(proto, "text").mockImplementation(function (this: { _fontSize: number }, ...args: unknown[]) {
      const [text, x, y, options] = args as [string, number, number, { baseline?: string } | undefined];
      if (typeof x === "number" && typeof y === "number") {
        calls.push({ text: String(text), x, y, font: currentFont, fontSize: this._fontSize, baseline: options?.baseline });
      }
      return originalText.apply(this, args);
    });
    vi.spyOn(proto, "translate").mockImplementation(function (this: unknown, ...args: unknown[]) {
      translations.push([args[0] as number, args[1] as number]);
      return originalTranslate.apply(this, args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The renderer registers the MICR font as "E13B"; nothing else is drawn in it.
  const micrCalls = () => calls.filter((c) => c.font === "E13B");

  describe.each(["A4", "LETTER"] as const)("on %s paper", (paperSize) => {
    it("places every field at its ANSI position", async () => {
      const d = data(paperSize);
      await renderer.render(d);
      const t = d.template;

      const position1Right = t.pageWidth - MICR.position1RightIn * PTS_PER_INCH;
      const rightEdgeOf = (endPosition: number) => position1Right - (endPosition - 1) * PITCH;

      const fields = micrCalls();
      expect(fields.map((f) => f.text)).toEqual([`${O}001001${O}`, `${T}111000025${T}`, `987654321012${O}`]);

      const [aux, transit, onUs] = fields as [TextCall, TextCall, TextCall];
      expect(onUs.x + onUs.text.length * PITCH).toBeCloseTo(rightEdgeOf(MICR_FIELD_END_POSITION.onUs), 6);
      expect(transit.x + transit.text.length * PITCH).toBeCloseTo(rightEdgeOf(MICR_FIELD_END_POSITION.transit), 6);
      expect(aux.x + aux.text.length * PITCH).toBeCloseTo(rightEdgeOf(MICR_FIELD_END_POSITION.auxOnUs), 6);

      // Transit is exactly positions 33–43: ⑆ + 9 digits + ⑆.
      expect(transit.x).toBeCloseTo(rightEdgeOf(43) - PITCH, 6);
    });

    it("puts the baseline 3/16 in above the check's bottom edge", async () => {
      const d = data(paperSize);
      await renderer.render(d);
      const checkBottom = d.template.checkArea.top + d.template.checkArea.height;

      for (const field of micrCalls()) {
        expect(field.baseline).toBe("alphabetic");
        expect(checkBottom - field.y).toBeCloseTo(0.1875 * PTS_PER_INCH, 6);
      }
    });

    it("keeps the amount field (positions 1–12) blank", async () => {
      const d = data(paperSize);
      await renderer.render(d);
      const position1Right = d.template.pageWidth - MICR.position1RightIn * PTS_PER_INCH;
      const amountFieldLeft = position1Right - 12 * PITCH;

      for (const field of micrCalls()) {
        expect(field.x + field.text.length * PITCH).toBeLessThanOrEqual(amountFieldLeft + 1e-6);
      }
    });

    it("prints nothing but the MICR line inside the 5/8 in clear band", async () => {
      const d = data(paperSize, {
        memo: "A long memo that should still stay above the band",
        invoiceItems: [{ description: "Mulch", amount: "1,250.50" }],
      });
      await renderer.render(d);
      const checkBottom = d.template.checkArea.top + d.template.checkArea.height;
      const bandTop = checkBottom - 0.625 * PTS_PER_INCH;
      const micr = new Set(micrCalls());

      const intruders = calls.filter(
        (c) => !micr.has(c) && c.y + c.fontSize > bandTop && c.y < checkBottom,
      );
      expect(intruders).toEqual([]);
    });
  });

  it("applies the printer profile's offset once, to the whole page", async () => {
    await renderer.render(data("A4", { horizontalOffsetPts: 8.04, verticalOffsetPts: -1.28 }));
    expect(translations).toContainEqual([8.04, -1.28]);
    // MICR coordinates stay in design space; the single page translation moves them.
    const onUs = micrCalls()[2]!;
    expect(onUs.x + onUs.text.length * PITCH).toBeCloseTo(595.28 - 22.5 - 13 * PITCH, 6);
  });

  it("refuses to render when the font is invalid and strict mode is on", async () => {
    const strict = new PdfRenderer(fontPath, { strictFont: true });
    const report = await strict.checkFont();
    if (report.ok) return; // A licensed font passes; this guards the development trial font.
    await expect(strict.render(data("A4"))).rejects.toMatchObject({ code: "MICR_FONT_INVALID" });
  });
});
