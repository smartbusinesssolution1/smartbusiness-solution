import { describe, expect, it } from "vitest";
import {
  evaluateVerification,
  verificationExpectations,
  VERIFICATION_ITEMS,
  type VerificationItem,
} from "./calibration.verification.js";
import { templateForPrinter } from "../pdf/pdf.templates.js";
import { PTS_PER_MM } from "../pdf/pdf.types.js";

const template = templateForPrinter({ paperSize: "A4", stockType: "PLAIN_PAPER", layout: "CHECK_MIDDLE" });
const expectations = verificationExpectations(template);
const expectedMm = Object.fromEntries(
  expectations.map((e) => [e.item, e.expectedPts / PTS_PER_MM]),
) as Record<VerificationItem, number>;

/** Measurements of a sample printed `rightMm` too far right and `downMm` too low. */
function measured(rightMm = 0, downMm = 0, overrides: Partial<Record<VerificationItem, number>> = {}) {
  return {
    upperTearLine: expectedMm.upperTearLine + downMm,
    lowerTearLine: expectedMm.lowerTearLine + downMm,
    micrBottom: expectedMm.micrBottom,
    micrRightEdge: expectedMm.micrRightEdge - rightMm,
    amountBoxLeft: expectedMm.amountBoxLeft + rightMm,
    ...overrides,
  };
}

describe("verificationExpectations (A4, check in middle)", () => {
  it("expects the five landmarks at their designed positions", () => {
    const mm = (item: VerificationItem) => Math.round(expectedMm[item] * 100) / 100;
    expect(VERIFICATION_ITEMS.map(mm)).toEqual([88.9, 177.8, 4.76, 49.21, 163.43]);
  });
});

describe("evaluateVerification", () => {
  it("passes a sample printed in place, with nothing to adjust", () => {
    const outcome = evaluateVerification(expectations, "mm", measured());
    expect(outcome.passed).toBe(true);
    expect(outcome.items.every((i) => i.status === "ok")).toBe(true);
    expect(outcome.suggestedAdjustment).toBeNull();
  });

  it("ignores shifts under 0.5 mm", () => {
    expect(evaluateVerification(expectations, "mm", measured(0.4, -0.3)).suggestedAdjustment).toBeNull();
  });

  it("suggests the opposite move for a shared shift", () => {
    const outcome = evaluateVerification(expectations, "mm", measured(1.2, 0.8));
    expect(outcome.suggestedAdjustment).toEqual({
      horizontalMm: -1.2,
      verticalMm: -0.8,
      description: "Move everything 1.2 mm left and 0.8 mm up, then print the sample again.",
    });
  });

  it("marks errors over 1/16 in as failures", () => {
    const outcome = evaluateVerification(expectations, "mm", measured(2, 0));
    expect(outcome.passed).toBe(false);
    expect(outcome.items.find((i) => i.item === "amountBoxLeft")!.status).toBe("fail");
  });

  it("marks errors between 1 mm and 1/16 in as marginal but passing", () => {
    const outcome = evaluateVerification(expectations, "mm", measured(1.3, 0));
    expect(outcome.passed).toBe(true);
    expect(outcome.items.find((i) => i.item === "amountBoxLeft")!.status).toBe("marginal");
  });

  it("detects page scaling from the tear-line spacing and suggests no move", () => {
    const outcome = evaluateVerification(
      expectations,
      "mm",
      measured(0, 0, { lowerTearLine: expectedMm.lowerTearLine + 2 }),
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.notes).toEqual([expect.stringMatching(/further apart than designed/)]);
    expect(outcome.suggestedAdjustment).toBeNull();
  });

  it("blames the font or scale when only the MICR height is wrong", () => {
    const outcome = evaluateVerification(
      expectations,
      "mm",
      measured(0, 0, { micrBottom: expectedMm.micrBottom + 3 }),
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.notes).toEqual([expect.stringMatching(/valid E-13B font/)]);
  });

  it("accepts inches", () => {
    const inches = Object.fromEntries(
      Object.entries(measured(1.2, 0)).map(([k, v]) => [k, v / 25.4]),
    ) as Record<VerificationItem, number>;
    expect(evaluateVerification(expectations, "in", inches).suggestedAdjustment?.horizontalMm).toBeCloseTo(-1.2, 1);
  });
});

// A real support case: an HP set up as a Letter, three-per-page printer with A4 paper in the
// tray. Left-edge readings and right-edge readings disagreed by about 6 mm on every sample,
// and the old averaged "move left 3.44 mm" suggestion could never make them agree.
describe("paper narrower or wider than the profile says", () => {
  const letter = verificationExpectations(templateForPrinter({ paperSize: "LETTER", stockType: "PLAIN_PAPER", layout: "THREE_PER_PAGE" }));

  it.each([
    ["first sample", { upperTearLine: 88, lowerTearLine: 176, micrBottom: 4.8, micrRightEdge: 43, amountBoxLeft: 170 }],
    ["after the suggested adjustment", { upperTearLine: 88.9, lowerTearLine: 178, micrBottom: 4.8, micrRightEdge: 47.5, amountBoxLeft: 165 }],
  ])("recognises A4 paper in a Letter profile (%s) instead of suggesting a shift", (_label, readings) => {
    const outcome = evaluateVerification(letter, "mm", readings, "LETTER");
    expect(outcome.passed).toBe(false);
    expect(outcome.suggestedAdjustment).toBeNull();
    expect(outcome.notes.join(" ")).toMatch(/A4 \(210 x 297 mm\) paper/);
    expect(outcome.notes.join(" ")).toMatch(/set up for US Letter/);
  });

  it("recognises Letter paper in an A4 profile", () => {
    const a4 = verificationExpectations(templateForPrinter({ paperSize: "A4", stockType: "PLAIN_PAPER", layout: "CHECK_MIDDLE" }));
    const exact = Object.fromEntries(a4.map((e) => [e.item, e.expectedPts / PTS_PER_MM])) as Record<VerificationItem, number>;
    const outcome = evaluateVerification(a4, "mm", { ...exact, micrRightEdge: exact.micrRightEdge + 5.9 }, "A4");
    expect(outcome.suggestedAdjustment).toBeNull();
    expect(outcome.notes.join(" ")).toMatch(/US Letter/);
  });

  it("says so in general terms for any other disagreement", () => {
    const outcome = evaluateVerification(expectations, "mm", measured(0, 0, { micrRightEdge: expectedMm.micrRightEdge - 3 }), "A4");
    expect(outcome.suggestedAdjustment).toBeNull();
    expect(outcome.notes.join(" ")).toMatch(/disagree by 3 mm/);
  });

  it("still corrects a real shift, where both edges agree", () => {
    const outcome = evaluateVerification(expectations, "mm", measured(1.2, 0.8), "A4");
    expect(outcome.notes).toEqual([]);
    expect(outcome.suggestedAdjustment).toMatchObject({ horizontalMm: -1.2, verticalMm: -0.8 });
  });
});
