import { ValidationError } from "../../shared/errors/index.js";
import {
  CALIBRATION_LIMITS,
  CALIBRATION_REF,
  PTS_PER_INCH,
  PTS_PER_MM,
} from "../pdf/pdf.types.js";
import type { PaperSize } from "../pdf/pdf.types.js";

const MM_PER_INCH = 25.4;

/** Ruler readings from one printed calibration sheet. */
export interface SheetReading {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface CalibrationMeasurements {
  unit: "mm" | "in";
  sheets: SheetReading[];
}

export interface Repeatability {
  sheets: number;
  // Largest minus smallest per-sheet offset: how far the printer wanders between sheets.
  spreadXPts: number;
  spreadYPts: number;
}

export interface CalibrationResult {
  horizontalOffsetPts: number;
  verticalOffsetPts: number;
  scaleX: number;
  scaleY: number;
  repeatability: Repeatability;
  warnings: string[];
}

interface SheetResult {
  offsetXPts: number;
  offsetYPts: number;
  scaleX: number;
  scaleY: number;
}

const mmText = (pts: number) => `${(pts / PTS_PER_MM).toFixed(1)} mm`;

/**
 * One sheet: X lines are measured from the left edge and Y lines from the top
 * edge, so one rule covers both axes: offset = expected − measured. A line
 * printed too far right or too low gives a negative offset, which moves
 * content left or up. The distance between the two lines of an axis reveals
 * scaling, which an offset cannot fix, so a scaled sheet is rejected.
 */
function computeSheet(paperSize: PaperSize, unit: "mm" | "in", sheet: SheetReading, label: string): SheetResult {
  const ref = CALIBRATION_REF[paperSize];
  const toInches = (v: number) => (unit === "mm" ? v / MM_PER_INCH : v);
  const x1 = toInches(sheet.x1);
  const x2 = toInches(sheet.x2);
  const y1 = toInches(sheet.y1);
  const y2 = toInches(sheet.y2);

  if (x2 <= x1 || y2 <= y1) {
    throw new ValidationError(`${label}: X2 must be further from the edge than X1, and Y2 further than Y1.`, {
      measurements: ["Check that the lines were not swapped"],
    });
  }

  const scaleX = (x2 - x1) / (ref.x2 - ref.x1);
  const scaleY = (y2 - y1) / (ref.y2 - ref.y1);

  const looksLike = (s: number, factor: number) => Math.abs(s / factor - 1) < 0.05;
  if (looksLike(scaleX, MM_PER_INCH) || looksLike(scaleX, 1 / MM_PER_INCH)) {
    const entered = unit === "in" ? "millimetres" : "inches";
    throw new ValidationError(
      `These values look like ${entered}, but the unit is set to "${unit}". Change the unit and save again.`,
      { "measurements.unit": ["Unit does not match the values"] },
    );
  }

  const maxScaleError = CALIBRATION_LIMITS.maxScaleError;
  if (Math.abs(scaleX - 1) > maxScaleError || Math.abs(scaleY - 1) > maxScaleError) {
    const pct = (s: number) => `${(s * 100).toFixed(1)}%`;
    throw new ValidationError(
      `${label} printed at ${pct(scaleX)} wide and ${pct(scaleY)} tall instead of 100%. ` +
        "Set the print scale to 100% (Actual Size), turn off Fit to page, confirm the paper size, and print the sheet again.",
      { measurements: ["Print scaling detected"] },
    );
  }

  // Averaging both lines of an axis halves the effect of a single misread on the ruler.
  return {
    offsetXPts: (((ref.x1 - x1) + (ref.x2 - x2)) / 2) * PTS_PER_INCH,
    offsetYPts: (((ref.y1 - y1) + (ref.y2 - y2)) / 2) * PTS_PER_INCH,
    scaleX,
    scaleY,
  };
}

/**
 * Turns ruler readings from several printed calibration sheets into PDF offsets.
 *
 * Calibration can only correct a shift that is the same on every sheet. The
 * sheets are therefore compared with each other first: if the printer places
 * them too differently, no single offset can keep the MICR line in tolerance,
 * and the profile is refused with advice on paper handling.
 */
export function computeCalibration(
  paperSize: PaperSize,
  m: CalibrationMeasurements,
): CalibrationResult {
  const { minSheets, maxSheets } = CALIBRATION_LIMITS;
  if (m.sheets.length < minSheets || m.sheets.length > maxSheets) {
    throw new ValidationError(`Print the calibration sheet ${minSheets} times and enter the readings from every sheet.`, {
      "measurements.sheets": [`Between ${minSheets} and ${maxSheets} sheets are required`],
    });
  }

  const results = m.sheets.map((sheet, i) => computeSheet(paperSize, m.unit, sheet, `Sheet ${i + 1}`));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

  const offsetsX = results.map((r) => r.offsetXPts);
  const offsetsY = results.map((r) => r.offsetYPts);
  const horizontalOffsetPts = mean(offsetsX);
  const verticalOffsetPts = mean(offsetsY);
  const spreadXPts = spread(offsetsX);
  const spreadYPts = spread(offsetsY);

  const axes = [
    { name: "left-right", spread: spreadXPts },
    { name: "up-down", spread: spreadYPts },
  ];
  const unstable = axes.filter((a) => a.spread > CALIBRATION_LIMITS.maxSpreadPts);
  if (unstable.length > 0) {
    const detail = unstable.map((a) => `${a.name} by ${mmText(a.spread)}`).join(" and ");
    throw new ValidationError(
      `The printer placed the sheets differently each time (${detail}; the limit is ${mmText(CALIBRATION_LIMITS.maxSpreadPts)}). ` +
        "No single correction can keep the MICR line within the bank's tolerance. Square the paper stack, slide the tray guides " +
        "until they touch the paper, print the calibration sheet again and re-measure.",
      { measurements: ["Printer is not repeatable enough"] },
    );
  }

  const largest = Math.max(Math.abs(horizontalOffsetPts), Math.abs(verticalOffsetPts));
  if (largest > CALIBRATION_LIMITS.maxOffsetPts) {
    throw new ValidationError(
      `The page is shifted by ${(largest / PTS_PER_INCH).toFixed(2)} in (${mmText(largest)}), ` +
        "more than the 0.5 in a printer normally shifts. Check the paper size, the tray guides, the measurement unit, " +
        "and that you measured from the left and top edges.",
      { measurements: ["Offset out of range"] },
    );
  }

  const warnings: string[] = [];
  for (const a of axes) {
    if (a.spread > CALIBRATION_LIMITS.warnSpreadPts) {
      warnings.push(
        `The sheets differ ${a.name} by ${mmText(a.spread)}. The profile was saved, but this printer is close to the limit: ` +
          "keep the paper stack square and the tray guides snug.",
      );
    }
  }
  if (largest > CALIBRATION_LIMITS.warnOffsetPts) {
    warnings.push(
      "This printer shifts the page by more than 1/4 inch. The offsets will compensate, but check that the paper guides are snug.",
    );
  }

  return {
    horizontalOffsetPts: round2(horizontalOffsetPts),
    verticalOffsetPts: round2(verticalOffsetPts),
    scaleX: round4(mean(results.map((r) => r.scaleX))),
    scaleY: round4(mean(results.map((r) => r.scaleY))),
    repeatability: { sheets: results.length, spreadXPts: round2(spreadXPts), spreadYPts: round2(spreadYPts) },
    warnings,
  };
}

/**
 * Older profiles stored one sheet as { unit, x1, x2, y1, y2 }; current ones store
 * { unit, sheets, repeatability }. Returns the readings in the current shape.
 */
export function normalizeStoredMeasurements(value: unknown): (CalibrationMeasurements & { repeatability?: Repeatability }) | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const unit = v.unit === "in" ? "in" : "mm";
  if (Array.isArray(v.sheets)) {
    return {
      unit,
      sheets: v.sheets as SheetReading[],
      repeatability: v.repeatability as Repeatability | undefined,
    };
  }
  if (typeof v.x1 === "number") {
    return { unit, sheets: [{ x1: v.x1, x2: v.x2 as number, y1: v.y1 as number, y2: v.y2 as number }] };
  }
  return null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
