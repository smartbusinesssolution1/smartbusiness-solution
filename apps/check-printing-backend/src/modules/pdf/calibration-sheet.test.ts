import PDFDocument from "pdfkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawCalibrationSheet } from "./calibration-sheet.js";
import { PdfService } from "./pdf.service.js";
import type { PdfRenderer } from "./pdf.renderer.js";
import type { ObjectStorage } from "../../shared/storage/index.js";
import { CALIBRATION_REF, PAPER, PTS_PER_INCH } from "./pdf.types.js";
import type { PaperSize } from "./pdf.types.js";

// The printer calibration sheet: one page, printed 3 times. The four reference lines must
// be exactly where CALIBRATION_REF v2 puts them (saved printers were measured against those
// positions), and the page must tell people to measure for themselves, without printing
// where the lines "should" be: people copied those numbers instead of measuring.

describe("printer calibration sheet", () => {
  it.each(["LETTER", "A4"] as const)("%s: the PDF is one page", async (size: PaperSize) => {
    const pdf = await new PdfService({} as PdfRenderer, {} as ObjectStorage).generateTestPage("Green Acres", size);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);
  });

  describe("what is drawn", () => {
    let texts: string[];
    let starts: Array<{ x: number; y: number }>;

    beforeEach(() => {
      texts = [];
      starts = [];
      const proto = PDFDocument.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
      const originalText = proto.text!;
      const originalMoveTo = proto.moveTo!;
      vi.spyOn(proto, "text").mockImplementation(function (this: unknown, ...args: unknown[]) {
        texts.push(String(args[0]));
        return originalText.apply(this, args);
      });
      vi.spyOn(proto, "moveTo").mockImplementation(function (this: unknown, ...args: unknown[]) {
        starts.push({ x: args[0] as number, y: args[1] as number });
        return originalMoveTo.apply(this, args);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const draw = (size: PaperSize) => {
      const doc = new PDFDocument({ size: [PAPER[size].width, PAPER[size].height], margin: 0 });
      drawCalibrationSheet(doc, { workspaceName: "Green Acres", paperSize: size, date: "2026-10-23" });
      doc.end();
    };

    it.each(["LETTER", "A4"] as const)("%s: the four lines are exactly where calibration expects them", (size: PaperSize) => {
      draw(size);
      const ref = CALIBRATION_REF[size];
      const [X1, X2, Y1, Y2] = [ref.x1, ref.x2, ref.y1, ref.y2].map((v) => v * PTS_PER_INCH) as [number, number, number, number];

      // X1 and X2 run down the page; Y1 and Y2 across it.
      expect(starts).toContainEqual({ x: X1, y: Y1 + 18 });
      expect(starts).toContainEqual({ x: X2, y: Y1 + 18 });
      expect(starts).toContainEqual({ x: X1 + 18, y: Y1 });
      expect(starts).toContainEqual({ x: X1 + 18, y: Y2 });
    });

    it("says beside each line which edge to measure from", () => {
      draw("LETTER");
      expect(texts).toContain("X1  ·  measure from the LEFT edge to this line");
      expect(texts).toContain("X2  ·  measure from the LEFT edge to this line");
      expect(texts).toContain("Y1  ·  measure from the TOP edge to this line");
      expect(texts).toContain("Y2  ·  measure from the TOP edge to this line");
    });

    it("tells people to print it 3 times, number the copies, and measure for themselves", () => {
      draw("LETTER");
      expect(texts).toContain("PRINT THIS PAGE 3 TIMES, AT ACTUAL SIZE (100%)");
      expect(texts).toContain("THIS IS SHEET");
      expect(texts).toContain("Write what YOUR ruler shows. Do not copy any number from this page.");
    });

    it("has one plain line to write on per measurement", () => {
      draw("LETTER");
      expect(texts).toEqual(expect.arrayContaining([
        "Your measurement from the LEFT edge to X1:",
        "Your measurement from the LEFT edge to X2:",
        "Your measurement from the TOP edge to Y1:",
        "Your measurement from the TOP edge to Y2:",
      ]));
    });

    it.each(["LETTER", "A4"] as const)("%s: never prints where a line should be (people copied it)", (size: PaperSize) => {
      draw(size);
      const ref = CALIBRATION_REF[size];
      const expected = [ref.x1, ref.x2, ref.y1, ref.y2].flatMap((inches: number) => [
        (inches * 25.4).toFixed(1),
        (inches * 25.4).toFixed(2),
        `${inches.toFixed(3)} in`,
      ]);
      for (const value of expected) {
        expect(texts.filter((t) => t.includes(value))).toEqual([]);
      }
    });
  });
});
