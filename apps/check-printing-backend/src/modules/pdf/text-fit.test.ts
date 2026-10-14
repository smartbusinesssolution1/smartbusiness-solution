import { describe, expect, it } from "vitest";
import { fitText, payeeFitsOnCheck, textWidth, PAYEE_FIT } from "./text-fit.js";

const SPEC = { font: "Helvetica", maxSize: 12, minSize: 8, width: 150 };

describe("fitText", () => {
  it("keeps short text at full size", () => {
    expect(fitText("Short memo", SPEC)).toEqual({ text: "Short memo", size: 12, truncated: false });
  });

  it("shrinks text before it truncates", () => {
    const text = "A memo slightly too long at twelve";
    expect(textWidth("Helvetica", 12, text)).toBeGreaterThan(SPEC.width);

    const result = fitText(text, SPEC);
    expect(result.truncated).toBe(false);
    expect(result.size).toBeLessThan(12);
    expect(result.size).toBeGreaterThanOrEqual(8);
    expect(textWidth("Helvetica", result.size, result.text)).toBeLessThanOrEqual(SPEC.width);
  });

  it("truncates with an ellipsis at the minimum size when shrinking is not enough", () => {
    const result = fitText("x".repeat(400), SPEC);
    expect(result.truncated).toBe(true);
    expect(result.size).toBe(8);
    expect(result.text.endsWith("…")).toBe(true);
    expect(textWidth("Helvetica", 8, result.text)).toBeLessThanOrEqual(SPEC.width);
  });
});

describe("payeeFitsOnCheck", () => {
  it("accepts a typical business name", () => {
    expect(payeeFitsOnCheck("Hill Country Supply Co.")).toBe(true);
  });

  it("rejects a name that could only print truncated", () => {
    const longName = "The Extraordinarily Long Named Landscaping and Irrigation Services Company of Central Texas LLC";
    expect(payeeFitsOnCheck(longName)).toBe(false);
  });

  it("agrees with fitText on the payee box", () => {
    const name = "Austin Equipment Rental & Supply Incorporated";
    expect(payeeFitsOnCheck(name, 200)).toBe(!fitText(name, { ...PAYEE_FIT, width: 200 }).truncated);
  });
});
