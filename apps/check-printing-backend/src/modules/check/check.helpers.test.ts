import { describe, expect, it } from "vitest";
import {
  amountToWords,
  assertTransition,
  hasAtMostTwoDecimals,
  isTerminalStatus,
  validateCheckDateRange,
} from "./check.helpers.js";

// The amount in words is the legally binding amount on a check (UCC 3-114), so
// every rule in DEVELOPER_BIBLE.md §"Amount to words" is pinned here.

describe("amountToWords: Bible conversion table", () => {
  it.each([
    [0.01, "Zero and 01/100"],
    [0.5, "Zero and 50/100"],
    [1, "One and 00/100"],
    [10, "Ten and 00/100"],
    [15.75, "Fifteen and 75/100"],
    [100, "One Hundred and 00/100"],
    [105, "One Hundred Five and 00/100"],
    [999.99, "Nine Hundred Ninety-Nine and 99/100"],
    [1000, "One Thousand and 00/100"],
    [1001, "One Thousand One and 00/100"],
    [1234.56, "One Thousand Two Hundred Thirty-Four and 56/100"],
    [10000, "Ten Thousand and 00/100"],
    [100000, "One Hundred Thousand and 00/100"],
  ])("%d → %s", (amount, words) => {
    expect(amountToWords(amount)).toBe(words);
  });
});

describe("amountToWords: rules", () => {
  it("rule 1: dollars in words, cents as a fraction, no 'Dollars' or 'Cents'", () => {
    const words = amountToWords(1234.56);
    expect(words).toMatch(/and 56\/100$/);
    expect(words).not.toMatch(/dollar|cent/i);
  });

  it("rule 2: 'and' appears only between dollars and cents", () => {
    for (const amount of [250.5, 1200.5, 101101.01, 999999.99]) {
      expect(amountToWords(amount).match(/\band\b/g)).toHaveLength(1);
    }
  });

  it("rule 3: cents are always two digits over 100", () => {
    expect(amountToWords(500)).toBe("Five Hundred and 00/100");
    expect(amountToWords(500.05)).toBe("Five Hundred and 05/100");
    expect(amountToWords(500.5)).toBe("Five Hundred and 50/100");
  });

  it("rule 5: hyphenates 21–99 and nothing else", () => {
    expect(amountToWords(21)).toBe("Twenty-One and 00/100");
    expect(amountToWords(99)).toBe("Ninety-Nine and 00/100");
    expect(amountToWords(111)).toBe("One Hundred Eleven and 00/100");
    expect(amountToWords(20)).toBe("Twenty and 00/100");
  });

  it("spells the largest printable amount", () => {
    expect(amountToWords(999999.99)).toBe(
      "Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine and 99/100",
    );
  });

  // Values whose binary representation sits just below the decimal value.
  it.each([
    [0.29, "Zero and 29/100"],
    [4.35, "Four and 35/100"],
    [1.15, "One and 15/100"],
    [8.7, "Eight and 70/100"],
    [100.07, "One Hundred and 07/100"],
    [123456.79, "One Hundred Twenty-Three Thousand Four Hundred Fifty-Six and 79/100"],
  ])("is exact for floating-point-awkward amount %d", (amount, words) => {
    expect(amountToWords(amount)).toBe(words);
  });

  it("matches the integer cents of every amount from $0.00 to $10.00", () => {
    for (let cents = 0; cents <= 1000; cents++) {
      const words = amountToWords(cents / 100);
      expect(words.endsWith(` and ${String(cents % 100).padStart(2, "0")}/100`)).toBe(true);
    }
  });

  it.each([-0.01, 1_000_000, Number.NaN, Number.POSITIVE_INFINITY])("rejects out-of-range amount %d", (amount) => {
    expect(() => amountToWords(amount)).toThrow(/between 0 and 999,999.99/);
  });

  it("rejects a third decimal instead of printing '100/100'", () => {
    expect(() => amountToWords(10.999)).toThrow(/whole cents/);
    expect(() => amountToWords(10.005)).toThrow(/whole cents/);
  });
});

describe("hasAtMostTwoDecimals", () => {
  it.each([1, 1.5, 1.25, 0.29, 4.35, 999999.99])("accepts %d", (v) => {
    expect(hasAtMostTwoDecimals(v)).toBe(true);
  });
  it.each([1.001, 10.999, 0.125, Number.NaN])("rejects %d", (v) => {
    expect(hasAtMostTwoDecimals(v)).toBe(false);
  });
});

describe("status transitions", () => {
  const allowed: Array<[string, string]> = [
    ["NEW", "PENDING_APPROVAL"],
    ["NEW", "APPROVED"],
    ["PENDING_APPROVAL", "APPROVED"],
    ["PENDING_APPROVAL", "REJECTED"],
    ["APPROVED", "PRINTED"],
    ["REJECTED", "PENDING_APPROVAL"],
    ["PRINTED", "CLEARED"],
    ["PRINTED", "VOID"],
  ];
  const statuses = ["NEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PRINTED", "CLEARED", "VOID"] as const;

  it("allows exactly the documented transitions", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        const isAllowed = allowed.some(([f, t]) => f === from && t === to);
        if (isAllowed) {
          expect(() => assertTransition(from, to), `${from} → ${to}`).not.toThrow();
        } else {
          expect(() => assertTransition(from, to), `${from} → ${to}`).toThrow(/Invalid status transition/);
        }
      }
    }
  });

  it("never prints a check twice or un-voids one", () => {
    expect(() => assertTransition("PRINTED", "PRINTED")).toThrow();
    expect(() => assertTransition("VOID", "PRINTED")).toThrow();
    expect(() => assertTransition("VOID", "APPROVED")).toThrow();
  });

  it("treats CLEARED and VOID as terminal", () => {
    expect(isTerminalStatus("CLEARED")).toBe(true);
    expect(isTerminalStatus("VOID")).toBe(true);
    expect(isTerminalStatus("PRINTED")).toBe(false);
  });
});

describe("validateCheckDateRange", () => {
  const now = new Date("2026-10-13T15:30:00Z");
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it.each([
    ["today", "2026-10-13", true],
    ["exactly 30 days back", "2026-09-13", true],
    ["31 days back", "2026-09-12", false],
    ["exactly 90 days ahead", "2027-01-11", true],
    ["91 days ahead", "2027-01-12", false],
  ])("%s", (_label, iso, valid) => {
    expect(validateCheckDateRange(day(iso), 30, 90, now).valid).toBe(valid);
  });

  it("explains which limit was exceeded", () => {
    expect(validateCheckDateRange(day("2026-01-01"), 30, 90, now).error).toBe(
      "Check date cannot be more than 30 days in the past",
    );
    expect(validateCheckDateRange(day("2027-06-01"), 30, 90, now).error).toBe(
      "Check date cannot be more than 90 days in the future",
    );
  });

  it("gives the same answer late in the UTC day", () => {
    const lateNow = new Date("2026-10-13T23:59:59Z");
    expect(validateCheckDateRange(day("2026-10-13"), 0, 0, lateNow).valid).toBe(true);
    expect(validateCheckDateRange(day("2026-10-14"), 0, 0, lateNow).valid).toBe(false);
  });
});
