import { describe, expect, it } from "vitest";
import {
  assertMicrPrintable,
  isMicrPrintableAccountNumber,
  isMicrPrintableCheckNumber,
  isValidAbaRoutingNumber,
} from "./micr-validation.js";

describe("isValidAbaRoutingNumber", () => {
  // Published routing numbers of real US banks.
  it.each(["111000025", "026009593", "021000021", "121000248", "011000015"])("accepts %s", (rtn) => {
    expect(isValidAbaRoutingNumber(rtn)).toBe(true);
  });

  it.each([
    ["a wrong check digit", "111000026"],
    ["two transposed digits", "110100025"],
    ["8 digits", "11100002"],
    ["10 digits", "1110000250"],
    ["letters", "11100002A"],
    ["spaces", "111 000 025"],
    ["empty", ""],
  ])("rejects %s", (_label, rtn) => {
    expect(isValidAbaRoutingNumber(rtn)).toBe(false);
  });
});

describe("MICR field lengths", () => {
  it.each(["1234", "987654321012", "12345678901234567"])("accepts account number %s", (n) => {
    expect(isMicrPrintableAccountNumber(n)).toBe(true);
  });

  it.each(["123", "123456789012345678", "1234-5678", "12345A"])("rejects account number %s", (n) => {
    expect(isMicrPrintableAccountNumber(n)).toBe(false);
  });

  it.each(["1", "001001", "123456789012345"])("accepts check number %s", (n) => {
    expect(isMicrPrintableCheckNumber(n)).toBe(true);
  });

  it.each(["", "1234567890123456", "12A"])("rejects check number %s", (n) => {
    expect(isMicrPrintableCheckNumber(n)).toBe(false);
  });
});

describe("assertMicrPrintable", () => {
  it("passes a valid MICR line", () => {
    expect(() =>
      assertMicrPrintable({ routingNumber: "111000025", accountNumber: "987654321012", checkNumber: "001001" }),
    ).not.toThrow();
  });

  it("reports every invalid field at once", () => {
    try {
      assertMicrPrintable({ routingNumber: "111000026", accountNumber: "12", checkNumber: "X" });
      expect.unreachable();
    } catch (err) {
      expect((err as { details: Record<string, string[]> }).details).toEqual({
        routingNumber: [expect.stringMatching(/ABA checksum/)],
        accountNumber: [expect.stringMatching(/4–17 digits/)],
        checkNumber: [expect.stringMatching(/1–15 digits/)],
      });
    }
  });
});
