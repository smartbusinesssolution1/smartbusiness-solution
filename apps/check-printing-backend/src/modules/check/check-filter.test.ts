import { describe, expect, it } from "vitest";
import { checkFilterQuerySchema, decodeCursor, encodeCursor, parseOmnibox } from "./check-filter.js";

// F06 (#6): the register's filter language. Pure parsing, no database.

describe("parseOmnibox: one search box that understands intent", () => {
  it.each([
    ["#1042", { checkNumber: 1042 }],
    ["# 1042", { checkNumber: 1042 }],
    ["$1,250.50", { amount: 1250.5 }],
    ["1250.50", { amount: 1250.5 }],
    ["$ 999", { amount: 999 }],
    ["****1012", { accountLast4: "1012" }],
    ["acme", { text: "acme" }],
    ["Hill Country", { text: "Hill Country" }],
  ])("%j", (q, expected) => {
    expect(parseOmnibox(q)).toEqual(expected);
  });

  it("a bare number may be a check number, an amount, or part of a name", () => {
    expect(parseOmnibox("1042")).toEqual({ checkNumber: 1042, amount: 1042, text: "1042" });
  });

  it("does not read a half-typed amount as money", () => {
    expect(parseOmnibox("12.345")).toEqual({ text: "12.345" });
  });
});

describe("cursor", () => {
  it("round-trips the position and refuses a cursor from another sort or a tampered one", () => {
    const cursor = encodeCursor({ sortBy: "amount", sortOrder: "asc", value: "1250.50", id: "abc" });
    expect(decodeCursor(cursor, "amount", "asc")).toEqual({ value: "1250.50", id: "abc" });
    expect(() => decodeCursor(cursor, "checkDate", "asc")).toThrow(/different sort/);
    expect(() => decodeCursor("not-a-cursor", "amount", "asc")).toThrow(/cursor/i);
  });
});

describe("checkFilterQuerySchema", () => {
  const parse = (q: Record<string, string>) => checkFilterQuerySchema.safeParse(q);

  it("reads comma-separated lists and defaults", () => {
    const r = parse({ status: "PRINTED, CLEARED", include: "totals,facets" });
    expect(r.success && r.data.status).toEqual(["PRINTED", "CLEARED"]);
    expect(r.success && r.data.include).toEqual(["totals", "facets"]);
    expect(r.success && r.data.limit).toBe(20);
    expect(r.success && r.data.sortBy).toBe("createdAt");
  });

  it.each([
    [{ staus: "PRINTED" }, "unknown filter (a typo must not return everything)"],
    [{ status: "PRINTD" }, "unknown status"],
    [{ amountMin: "12.345" }, "fractions of a cent"],
    [{ amountMin: "500", amountMax: "100" }, "min above max"],
    [{ checkDateFrom: "2026-10-10", checkDateTo: "2026-10-01" }, "from after to"],
    [{ checkNumberFrom: "2000", checkNumberTo: "1000" }, "number range reversed"],
    [{ checkDateFrom: "10/01/2026" }, "not an ISO date"],
    [{ limit: "500" }, "page too large"],
    [{ cursor: "x", page: "2" }, "cursor and page together"],
  ] as Array<[Record<string, string>, string]>)("refuses %j (%s)", (q) => {
    expect(parse(q).success).toBe(false);
  });
});
