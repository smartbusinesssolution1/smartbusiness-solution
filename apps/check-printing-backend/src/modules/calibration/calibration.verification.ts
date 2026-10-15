import {
  CALIBRATION_LIMITS,
  MICR,
  MICR_FIELD_END_POSITION,
  PTS_PER_INCH,
  PTS_PER_MM,
} from "../pdf/pdf.types.js";
import type { CheckTemplate } from "../pdf/pdf.types.js";

export const VERIFICATION_ITEMS = [
  "upperTearLine",
  "lowerTearLine",
  "micrBottom",
  "micrRightEdge",
  "amountBoxLeft",
] as const;

export type VerificationItem = (typeof VERIFICATION_ITEMS)[number];

export interface VerificationExpectation {
  item: VerificationItem;
  label: string;
  from: string;
  expectedPts: number;
}

/**
 * Where five landmarks of a sample check should be on the paper, in points.
 * Positions are physical (the design), so they hold whatever offsets the
 * profile applies: a correctly calibrated printer puts ink exactly here.
 */
export function verificationExpectations(tmpl: CheckTemplate): VerificationExpectation[] {
  // The two upper lines across the sheet (every layout has at least two).
  const boundaries = tmpl.cutLines.map((l) => l.y).sort((a, b) => a - b);
  const edge = tmpl.tearGuides ? "tear line" : "perforation";
  // On check-on-bottom paper the check's bottom edge is the paper's edge, not a line.
  const checkBottom = tmpl.checkArea.top + tmpl.checkArea.height;
  const micrFrom = checkBottom >= tmpl.pageHeight - 0.5 ? "Bottom edge of paper" : `Check's bottom ${edge}`;

  return [
    { item: "upperTearLine", label: `Upper ${edge}`, from: "Top edge of paper", expectedPts: boundaries[0]! },
    { item: "lowerTearLine", label: `Lower ${edge}`, from: "Top edge of paper", expectedPts: boundaries[1]! },
    {
      item: "micrBottom",
      label: "Bottom of MICR digits",
      from: micrFrom,
      expectedPts: MICR.baselineFromBottomIn * PTS_PER_INCH,
    },
    {
      item: "micrRightEdge",
      label: "Right end of MICR line",
      from: "Right edge of paper",
      expectedPts: MICR.position1RightIn * PTS_PER_INCH + (MICR_FIELD_END_POSITION.onUs - 1) * MICR.pitchPts,
    },
    { item: "amountBoxLeft", label: "Left border of amount box", from: "Left edge of paper", expectedPts: tmpl.elements.amountBox.x },
  ];
}

export type VerificationStatus = "ok" | "marginal" | "fail";

export interface VerificationOutcome {
  passed: boolean;
  items: Array<{
    item: VerificationItem;
    label: string;
    expectedMm: number;
    measuredMm: number;
    errorMm: number;
    status: VerificationStatus;
  }>;
  // Positive horizontal = move content right; positive vertical = move content down.
  suggestedAdjustment: { horizontalMm: number; verticalMm: number; description: string } | null;
  notes: string[];
}

const toMm = (pts: number) => Math.round((pts / PTS_PER_MM) * 100) / 100;

function statusFor(errorPts: number): VerificationStatus {
  const e = Math.abs(errorPts);
  if (e <= CALIBRATION_LIMITS.verifyGoodPts) return "ok";
  if (e <= CALIBRATION_LIMITS.verifyMaxPts) return "marginal";
  return "fail";
}

/**
 * Compares measurements of a printed sample check with the design.
 *
 * The four position measurements reveal one shared shift per axis, which a fine
 * adjustment can correct. The distance between the two tear lines reveals
 * scaling, and the MICR height above the check's edge reveals font or scale
 * problems; neither can be fixed by moving the page.
 */
export function evaluateVerification(
  expectations: VerificationExpectation[],
  unit: "mm" | "in",
  measured: Record<VerificationItem, number>,
): VerificationOutcome {
  const toPts = (v: number) => (unit === "mm" ? v * PTS_PER_MM : v * PTS_PER_INCH);
  const expected = Object.fromEntries(expectations.map((e) => [e.item, e.expectedPts])) as Record<VerificationItem, number>;
  const actual = Object.fromEntries(VERIFICATION_ITEMS.map((i) => [i, toPts(measured[i])])) as Record<VerificationItem, number>;
  const error = Object.fromEntries(VERIFICATION_ITEMS.map((i) => [i, actual[i] - expected[i]])) as Record<VerificationItem, number>;

  const items = expectations.map((e) => ({
    item: e.item,
    label: e.label,
    expectedMm: toMm(e.expectedPts),
    measuredMm: toMm(actual[e.item]),
    errorMm: toMm(error[e.item]),
    status: statusFor(error[e.item]),
  }));

  const notes: string[] = [];

  const checkHeightError = error.lowerTearLine - error.upperTearLine;
  const scaled = Math.abs(checkHeightError) > CALIBRATION_LIMITS.scaleCheckPts;
  if (scaled) {
    notes.push(
      `The two tear lines are ${Math.abs(toMm(checkHeightError))} mm ${checkHeightError > 0 ? "further apart" : "closer together"} than designed, ` +
        "so the page was scaled while printing. Set the print scale to 100% (Actual Size) and print the sample again.",
    );
  }

  // Shared shift per axis. "Printed right" is positive: the amount box measures further
  // from the left edge, and the MICR line end measures closer to the right edge.
  const shiftRightPts = (error.amountBoxLeft - error.micrRightEdge) / 2;
  const shiftDownPts = (error.upperTearLine + error.lowerTearLine) / 2;

  if (statusFor(error.micrBottom) === "fail" && statusFor(shiftDownPts) !== "fail") {
    notes.push(
      "The MICR line sits at the wrong height above the check's edge although the page itself is in place. " +
        "Moving the page cannot fix this: check the print scale and that a valid E-13B font is installed.",
    );
  }

  let suggestedAdjustment: VerificationOutcome["suggestedAdjustment"] = null;
  const needsX = Math.abs(shiftRightPts) > CALIBRATION_LIMITS.adjustThresholdPts;
  const needsY = Math.abs(shiftDownPts) > CALIBRATION_LIMITS.adjustThresholdPts;
  if (!scaled && (needsX || needsY)) {
    const parts: string[] = [];
    if (needsX) parts.push(`${Math.abs(toMm(shiftRightPts))} mm ${shiftRightPts > 0 ? "left" : "right"}`);
    if (needsY) parts.push(`${Math.abs(toMm(shiftDownPts))} mm ${shiftDownPts > 0 ? "up" : "down"}`);
    suggestedAdjustment = {
      horizontalMm: needsX ? -toMm(shiftRightPts) : 0,
      verticalMm: needsY ? -toMm(shiftDownPts) : 0,
      description: `Move everything ${parts.join(" and ")}, then print the sample again.`,
    };
  }

  const passed = !scaled && items.every((i) => i.status !== "fail");
  return { passed, items, suggestedAdjustment, notes };
}
