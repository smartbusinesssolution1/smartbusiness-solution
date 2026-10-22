import { describe, expect, it } from "vitest";
import { Prisma } from "@smartbusiness/database";
import { auditChanges } from "./audit-changes.js";

describe("auditChanges", () => {
  it("records old and new values of the fields that changed, and nothing else", () => {
    const before = { payeeName: "Lala Company", memo: null, amount: new Prisma.Decimal("500") };
    const after = { payeeName: "Lala Company", memo: "Invoice 778", amount: 5000 };

    expect(auditChanges(before, after, { money: ["amount"] })).toEqual({
      memo: { from: null, to: "Invoice 778" },
      amount: { from: "500.00", to: "5000.00" },
    });
  });

  it("money compares by value: 500 and Decimal 500.00 are the same", () => {
    expect(auditChanges({ amount: new Prisma.Decimal("500.00") }, { amount: 500 }, { money: ["amount"] })).toEqual({});
  });

  it("calendar days read as 2026-10-22; other moments keep their time", () => {
    const changes = auditChanges(
      { checkDate: new Date("2026-10-01T00:00:00Z"), at: new Date("2026-10-01T09:30:00Z") },
      { checkDate: new Date("2026-10-22T00:00:00Z"), at: new Date("2026-10-02T09:30:00Z") },
    );
    expect(changes).toEqual({
      checkDate: { from: "2026-10-01", to: "2026-10-22" },
      at: { from: "2026-10-01T09:30:00.000Z", to: "2026-10-02T09:30:00.000Z" },
    });
  });

  it("only allowed fields are ever recorded", () => {
    const changes = auditChanges(
      { isActive: true, accountNumberEncrypted: "old-secret" },
      { isActive: false, accountNumberEncrypted: "new-secret" },
      { fields: ["isActive"] },
    );
    expect(changes).toEqual({ isActive: { from: true, to: false } });
  });

  it("fields not being written are skipped; nested values compare by content", () => {
    const lines = [{ description: "Mulch", amount: "100.00" }];
    expect(auditChanges({ items: lines, memo: "x" }, { items: [{ description: "Mulch", amount: "100.00" }], memo: undefined })).toEqual({});
    expect(auditChanges({ items: lines }, { items: [] })).toEqual({ items: { from: lines, to: [] } });
  });
});
