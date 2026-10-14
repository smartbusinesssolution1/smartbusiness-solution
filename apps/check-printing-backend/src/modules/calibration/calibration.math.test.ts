import { describe, expect, it } from "vitest";
import { computeCalibration, normalizeStoredMeasurements, type SheetReading } from "./calibration.math.js";
import { CALIBRATION_REF, PTS_PER_MM } from "../pdf/pdf.types.js";

// Reference lines on the A4 sheet: X from the left edge, Y from the top edge.
const REF = CALIBRATION_REF.A4;
const MM = 25.4;

/** A sheet as a printer with this shift (mm, + = right/down) and scale would print it. */
function sheet(shiftXmm = 0, shiftYmm = 0, scale = 1): SheetReading {
  return {
    x1: REF.x1 * MM * scale + shiftXmm,
    x2: REF.x2 * MM * scale + shiftXmm,
    y1: REF.y1 * MM * scale + shiftYmm,
    y2: REF.y2 * MM * scale + shiftYmm,
  };
}

const three = (s: SheetReading) => [s, s, s];

describe("computeCalibration", () => {
  it("gives zero offsets for a printer that prints exactly in place", () => {
    const result = computeCalibration("A4", { unit: "mm", sheets: three(sheet()) });
    expect(result.horizontalOffsetPts).toBe(0);
    expect(result.verticalOffsetPts).toBe(0);
    expect(result.scaleX).toBe(1);
    expect(result.scaleY).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("moves content opposite to the measured shift: offset = expected − measured", () => {
    // Printer puts everything 2 mm right and 1 mm low.
    const result = computeCalibration("A4", { unit: "mm", sheets: three(sheet(2, 1)) });
    expect(result.horizontalOffsetPts).toBeCloseTo(-2 * PTS_PER_MM, 1);
    expect(result.verticalOffsetPts).toBeCloseTo(-1 * PTS_PER_MM, 1);
  });

  it("accepts inches and millimetres for the same physical result", () => {
    const mm = computeCalibration("A4", { unit: "mm", sheets: three(sheet(-1.5, 0.8)) });
    const s = sheet(-1.5, 0.8);
    const inches = { x1: s.x1 / MM, x2: s.x2 / MM, y1: s.y1 / MM, y2: s.y2 / MM };
    const inch = computeCalibration("A4", { unit: "in", sheets: three(inches) });
    expect(inch.horizontalOffsetPts).toBeCloseTo(mm.horizontalOffsetPts, 1);
    expect(inch.verticalOffsetPts).toBeCloseTo(mm.verticalOffsetPts, 1);
  });

  it("averages the sheets and reports how far they spread", () => {
    const result = computeCalibration("A4", {
      unit: "mm",
      sheets: [sheet(1, 0), sheet(1.6, 0), sheet(1.3, 0)],
    });
    expect(result.horizontalOffsetPts).toBeCloseTo(-1.3 * PTS_PER_MM, 1);
    expect(result.repeatability).toEqual({
      sheets: 3,
      spreadXPts: expect.closeTo(0.6 * PTS_PER_MM, 1),
      spreadYPts: 0,
    });
  });

  it("warns when sheets differ by more than 1 mm", () => {
    const result = computeCalibration("A4", { unit: "mm", sheets: [sheet(0, 0), sheet(1.5, 0), sheet(0.5, 0)] });
    expect(result.warnings).toEqual([expect.stringMatching(/differ left-right by 1\.5 mm/)]);
  });

  it("refuses a printer whose sheets differ by more than 2 mm", () => {
    expect(() =>
      computeCalibration("A4", { unit: "mm", sheets: [sheet(0, 0), sheet(0, 2.5), sheet(0, 1)] }),
    ).toThrow(/placed the sheets differently each time \(up-down by 2\.5 mm/);
  });

  it("warns above a 1/4 in shift and refuses above 1/2 in", () => {
    const warned = computeCalibration("A4", { unit: "mm", sheets: three(sheet(8, 0)) });
    expect(warned.warnings).toEqual([expect.stringMatching(/more than 1\/4 inch/)]);

    expect(() => computeCalibration("A4", { unit: "mm", sheets: three(sheet(14, 0)) })).toThrow(
      /more than the 0\.5 in a printer normally shifts/,
    );
  });

  it("refuses a sheet printed with scaling, which an offset cannot fix", () => {
    expect(() => computeCalibration("A4", { unit: "mm", sheets: three(sheet(0, 0, 0.97)) })).toThrow(
      /printed at 97\.0% wide and 97\.0% tall instead of 100%/,
    );
  });

  it("tolerates scaling within 1%", () => {
    expect(() => computeCalibration("A4", { unit: "mm", sheets: three(sheet(0, 0, 0.995)) })).not.toThrow();
  });

  it("detects millimetres entered with the unit set to inches", () => {
    expect(() => computeCalibration("A4", { unit: "in", sheets: three(sheet()) })).toThrow(
      /look like millimetres, but the unit is set to "in"/,
    );
  });

  it("detects swapped lines", () => {
    const s = sheet();
    expect(() =>
      computeCalibration("A4", { unit: "mm", sheets: three({ ...s, x1: s.x2, x2: s.x1 }) }),
    ).toThrow(/X2 must be further from the edge than X1/);
  });

  it.each([2, 6])("requires 3 to 5 sheets (rejects %i)", (count) => {
    expect(() =>
      computeCalibration("A4", { unit: "mm", sheets: Array.from({ length: count }, () => sheet()) }),
    ).toThrow(/Print the calibration sheet 3 times/);
  });

  it("uses the Letter reference lines for Letter paper", () => {
    const L = CALIBRATION_REF.LETTER;
    const letter = { x1: L.x1 * MM, x2: L.x2 * MM, y1: L.y1 * MM, y2: L.y2 * MM };
    const result = computeCalibration("LETTER", { unit: "mm", sheets: three(letter) });
    expect(result.horizontalOffsetPts).toBe(0);
    expect(result.scaleY).toBe(1);
  });
});

describe("normalizeStoredMeasurements", () => {
  it("reads the current multi-sheet shape", () => {
    const stored = { unit: "mm", sheets: [sheet()], repeatability: { sheets: 1, spreadXPts: 0, spreadYPts: 0 } };
    expect(normalizeStoredMeasurements(stored)).toEqual(stored);
  });

  it("upgrades the old single-sheet shape", () => {
    expect(normalizeStoredMeasurements({ unit: "in", x1: 1, x2: 7.25, y1: 1, y2: 10.5 })).toEqual({
      unit: "in",
      sheets: [{ x1: 1, x2: 7.25, y1: 1, y2: 10.5 }],
    });
  });

  it.each([null, undefined, "x", 42, {}])("returns null for unusable data: %s", (value) => {
    expect(normalizeStoredMeasurements(value)).toBeNull();
  });
});
