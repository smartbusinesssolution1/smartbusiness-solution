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
