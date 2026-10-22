import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categoryOf, changesOf, describe as describeEntry, type Labels } from "./activity-catalog.js";

// Every action the services write must read as a sentence in the activity log: adding a
// new audit action without describing it fails here, not in front of an auditor.

const ROOTS = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../../../platform-api/src")];

// Names that appear as `action:` only in application log lines, never in the audit table.
const NOT_AUDITED = new Set(["PASSWORD_RESET_THROTTLED", "INVITATION_SKIPPED"]);

function actionsInSource(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
        // `action: "X"` in an audit call, and `action = "X"` when the code picks it first.
        for (const m of fs.readFileSync(full, "utf8").matchAll(/\baction(?::|\s*=)\s*([^,;\n}]+)/g)) {
          for (const code of m[1]!.matchAll(/"([A-Z][A-Z_]+)"/g)) found.add(code[1]!);
        }
      }
    }
  };
  ROOTS.forEach(walk);
  return found;
}

const noLabels: Labels = {
  check: () => undefined,
  bankAccount: () => undefined,
  payee: () => undefined,
  rule: () => undefined,
  printer: () => undefined,
  user: () => undefined,
};

describe("activity catalog", () => {
  it("knows every action the services write", () => {
    const actions = [...actionsInSource()].filter((a) => !NOT_AUDITED.has(a));
    expect(actions.length).toBeGreaterThan(60);
    expect(actions.filter((a) => categoryOf(a) === "other")).toEqual([]);
  });

  it("an unknown action still reads as words", () => {
    expect(describeEntry({ action: "SOMETHING_NEW", entityType: "X", entityId: "1", details: {} }, noLabels)).toBe("something new");
  });

  it("describes from the entry's own details when the record can't be found", () => {
    const e = { action: "CHECK_VOIDED", entityType: "Check", entityId: "gone", details: { checkNumber: 5007, stopPaymentAdvised: true } };
    expect(describeEntry(e, noLabels)).toBe("voided check #5007 after it was printed");
  });

  it("before → after in a fixed order, whatever order the database returns", () => {
    const changes = changesOf("CHECK_UPDATED", {
      changes: { memo: { from: null, to: "x" }, amount: { from: "1.00", to: "2.00" }, payeeName: { from: "A", to: "B" } },
    });
    expect(changes.map((c) => c.label)).toEqual(["Payee", "Amount", "Memo"]);
  });
});
