import { describe, expect, it } from "vitest";
import { buildCheckTemplate, templateForPrinter } from "./pdf.templates.js";
import { PAPER, type CheckLayout, type PaperSize } from "./pdf.types.js";

// #5: where the check, stubs and tear lines go for every layout.

const IN = 72;

describe("check position on the sheet", () => {
  it.each([
    ["CHECK_TOP", "LETTER", 0],
    ["CHECK_MIDDLE", "LETTER", 3.5 * IN],
    ["CHECK_BOTTOM", "LETTER", 11 * IN - 3.5 * IN],
    ["CHECK_BOTTOM", "A4", PAPER.A4.height - 3.5 * IN],
  ] as const)("%s on %s: the check's top edge is at %d pt", (layout, paper, top) => {
    const t = buildCheckTemplate(layout, paper);
    expect(t.checkArea.top).toBeCloseTo(top, 6);
    expect(t.checkArea.height).toBe(3.5 * IN);
  });

  it("check-on-bottom really is at the bottom (the old builder printed it at the top)", () => {
    const t = buildCheckTemplate("CHECK_BOTTOM", "LETTER");
    expect(t.checkArea.top).not.toBe(0);
    expect(t.checkArea.top + t.checkArea.height).toBe(PAPER.LETTER.height);
    expect(t.name).toBe("Check on Bottom");
  });

  it.each([1, 2, 3] as const)("three per page, slot %i, is the %i-th 3.5 in band from the top", (slot) => {
    const t = buildCheckTemplate("THREE_PER_PAGE", "LETTER", { position: slot });
    expect(t.checkArea.top).toBe((slot - 1) * 3.5 * IN);
    expect(t.position).toBe(slot);
  });

  it("ignores a slot for layouts with one check per sheet", () => {
    const t = buildCheckTemplate("CHECK_MIDDLE", "LETTER", { position: 3 });
    expect(t.position).toBe(1);
    expect(t.checkArea.top).toBe(3.5 * IN);
  });

  it("moves every element on the check together with the check", () => {
    const top = buildCheckTemplate("CHECK_TOP", "LETTER");
    const bottom = buildCheckTemplate("CHECK_BOTTOM", "LETTER");
    const shift = bottom.checkArea.top - top.checkArea.top;
    for (const key of Object.keys(top.elements) as Array<keyof typeof top.elements>) {
      if (key === "micr") continue; // placed from the check's bottom edge by the renderer
      expect(bottom.elements[key].y - top.elements[key].y, key).toBeCloseTo(shift, 6);
      expect(bottom.elements[key].x, key).toBe(top.elements[key].x);
    }
  });
});

describe("stubs and tear lines", () => {
  it.each(["CHECK_TOP", "CHECK_MIDDLE", "CHECK_BOTTOM"] as const)("%s has an employee and an employer stub", (layout) => {
    expect(buildCheckTemplate(layout, "LETTER").stubs.map((s) => s.label)).toEqual(["EMPLOYEE COPY", "EMPLOYER COPY"]);
  });

  it("three per page has no stubs and a line every 3.5 in", () => {
    const t = buildCheckTemplate("THREE_PER_PAGE", "LETTER", { position: 2 });
    expect(t.stubs).toEqual([]);
    expect(t.cutLines.map((l) => l.y)).toEqual([252, 504, 756]);
  });

  const CASES: Array<[CheckLayout, PaperSize, 1 | 2 | 3]> = [
    ["CHECK_TOP", "LETTER", 1],
    ["CHECK_MIDDLE", "A4", 1],
    ["CHECK_BOTTOM", "LETTER", 1],
    ["CHECK_BOTTOM", "A4", 1],
    ["THREE_PER_PAGE", "LETTER", 1],
    ["THREE_PER_PAGE", "LETTER", 2],
    ["THREE_PER_PAGE", "A4", 3],
  ];

  it.each(CASES)("%s on %s (slot %i): zones never overlap the check, and tear-line labels never land on it", (layout, paper, slot) => {
    const t = buildCheckTemplate(layout, paper, { position: slot });
    const checkTop = t.checkArea.top;
    const checkBottom = checkTop + t.checkArea.height;

    for (const stub of t.stubs) {
      expect(stub.top + stub.height <= checkTop || stub.top >= checkBottom, stub.label).toBe(true);
    }
    expect(t.sampleArea.top + t.sampleArea.height <= checkTop || t.sampleArea.top >= checkBottom).toBe(true);
    expect(t.sampleArea.top + t.sampleArea.height).toBeLessThanOrEqual(t.pageHeight + 0.01);

    for (const line of t.cutLines) {
      // The label is ~10 pt tall: above the line (y-10..y) or below it (y..y+10).
      const labelTop = line.labelAbove ? line.y - 10 : line.y;
      const labelBottom = labelTop + 10;
      const onCheck = labelBottom > checkTop && labelTop < checkBottom;
      expect(onCheck, `line at ${line.y}`).toBe(false);
    }
  });

  it("has at least two lines across the sheet for the verification landmarks", () => {
    for (const [layout, paper, slot] of CASES) {
      expect(buildCheckTemplate(layout, paper, { position: slot }).cutLines.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("templateForPrinter", () => {
  it("prints tear lines on plain paper only (perforated stock already has them)", () => {
    expect(templateForPrinter({ paperSize: "A4", stockType: "PLAIN_PAPER", layout: "CHECK_BOTTOM" }).tearGuides).toBe(true);
    expect(templateForPrinter({ paperSize: "A4", stockType: "PERFORATED_STOCK", layout: "CHECK_BOTTOM" }).tearGuides).toBe(false);
  });
});
