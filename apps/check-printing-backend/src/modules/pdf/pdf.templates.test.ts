import { describe, expect, it } from "vitest";
import { buildCheckTemplate, planSheets, REUSE_NOTE, templateForPrinter } from "./pdf.templates.js";
import { SHEET_NOTE_FIT, sheetNoteWidth } from "./pdf.renderer.js";
import { fitText } from "./text-fit.js";
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
      if (line.label === null) continue;
      // The label is ~10 pt tall: above the line (y-10..y) or below it (y..y+10).
      const labelTop = line.label === "above" ? line.y - 10 : line.y;
      const labelBottom = labelTop + 10;
      const onCheck = labelBottom > checkTop && labelTop < checkBottom;
      expect(onCheck, `line at ${line.y}`).toBe(false);
    }
  });

  it.each([1, 2, 3] as const)("three per page, slot %i: no tear-line label lands on ANY slot (all three can hold checks)", (slot) => {
    const t = buildCheckTemplate("THREE_PER_PAGE", "LETTER", { position: slot });
    for (const line of t.cutLines) {
      if (line.label === null) continue;
      const labelTop = line.label === "above" ? line.y - 10 : line.y;
      for (const slotTop of [0, 252, 504]) {
        expect(labelTop + 10 > slotTop && labelTop < slotTop + 252, `line ${line.y} vs slot at ${slotTop}`).toBe(false);
      }
    }
    // The same lines whatever the slot, so a job with several checks draws them once per sheet.
    expect(t.cutLines).toEqual(buildCheckTemplate("THREE_PER_PAGE", "LETTER", { position: 1 }).cutLines);
  });

  it.each(["LETTER", "A4"] as const)("three per page on %s: the reuse note sits below the bottom slot, inside the printable area, and fits", (paper) => {
    const t = buildCheckTemplate("THREE_PER_PAGE", paper, { position: 2 });
    expect(t.sheetNote?.text).toBe(REUSE_NOTE);
    const top = t.sheetNote!.y;
    // Below every slot (the bottom slot ends at 10.5 in) and at least 1/4 in above the paper's edge.
    expect(top).toBeGreaterThanOrEqual(3 * 252);
    expect(top + 7).toBeLessThanOrEqual(t.pageHeight - 18);
    // Shrunk if needed, never cut off.
    expect(fitText(REUSE_NOTE, SHEET_NOTE_FIT(sheetNoteWidth(t.pageWidth))).truncated).toBe(false);
  });

  it.each(["CHECK_TOP", "CHECK_MIDDLE", "CHECK_BOTTOM"] as const)("%s has no reuse note (one check per sheet)", (layout) => {
    expect(buildCheckTemplate(layout, "LETTER").sheetNote).toBeNull();
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

describe("planSheets: where each check of a print job goes", () => {
  const slots = (plan: ReturnType<typeof planSheets>) => plan.placements.map((p) => `${p.sheet}:${p.position}`);

  it("fills a fresh three-per-page sheet top, middle, bottom, then starts the next sheet", () => {
    const plan = planSheets(7, "THREE_PER_PAGE", 1);
    expect(slots(plan)).toEqual(["0:1", "0:2", "0:3", "1:1", "1:2", "1:3", "2:1"]);
    expect(plan.sheetCount).toBe(3);
    expect(plan.nextPosition).toBe(2);
  });

  it("starts on a partly used sheet at its first blank slot", () => {
    const plan = planSheets(3, "THREE_PER_PAGE", 2);
    expect(slots(plan)).toEqual(["0:2", "0:3", "1:1"]);
    expect(plan.sheetCount).toBe(2);
    expect(plan.nextPosition).toBe(2);
  });

  it("starting in the bottom slot puts one check on the first sheet", () => {
    const plan = planSheets(2, "THREE_PER_PAGE", 3);
    expect(slots(plan)).toEqual(["0:3", "1:1"]);
    expect(plan.sheetCount).toBe(2);
  });

  it("a job that fills the last sheet leaves a fresh sheet next (slot 1)", () => {
    expect(planSheets(3, "THREE_PER_PAGE", 1)).toMatchObject({ sheetCount: 1, nextPosition: 1 });
    expect(planSheets(1, "THREE_PER_PAGE", 3)).toMatchObject({ sheetCount: 1, nextPosition: 1 });
  });

  it.each([1, 2, 3] as const)("never reuses a slot, from start slot %i, for any job size", (start) => {
    for (let count = 1; count <= 30; count++) {
      const plan = planSheets(count, "THREE_PER_PAGE", start);
      const keys = slots(plan);
      expect(new Set(keys).size).toBe(count);
      expect(plan.placements.every((p) => p.sheet < plan.sheetCount)).toBe(true);
      // The last sheet is the one the last check is on.
      expect(plan.placements[count - 1]!.sheet).toBe(plan.sheetCount - 1);
    }
  });

  it.each(["CHECK_TOP", "CHECK_MIDDLE", "CHECK_BOTTOM"] as const)("%s: one check per sheet, no slots", (layout) => {
    const plan = planSheets(3, layout);
    expect(slots(plan)).toEqual(["0:null", "1:null", "2:null"]);
    expect(plan).toMatchObject({ sheetCount: 3, nextPosition: null });
  });
});
