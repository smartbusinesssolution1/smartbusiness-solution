import { describe, expect, it } from "vitest";
import { createBankAccountSchema } from "./bank-account.schema.js";

const valid = { routingNumber: "021000021", accountNumber: "000123456789", accountType: "CHECKING", startingCheckNumber: 1001 };

describe("createBankAccountSchema account number", () => {
  // BUG_036: an all-zero account number used to be accepted and printed on the MICR line.
  it.each(["0000", "00000000", "00000000000000000"])("refuses %s (only zeros)", (accountNumber) => {
    const result = createBankAccountSchema.safeParse({ ...valid, accountNumber });

    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toContain("Account number cannot contain only zeros.");
  });

  it.each(["000123456789", "1000", "0001"])("still accepts %s (leading zeros are normal)", (accountNumber) => {
    expect(createBankAccountSchema.safeParse({ ...valid, accountNumber }).success).toBe(true);
  });

  it("keeps the length and digits-only rules", () => {
    expect(createBankAccountSchema.safeParse({ ...valid, accountNumber: "123" }).success).toBe(false);
    expect(createBankAccountSchema.safeParse({ ...valid, accountNumber: "12a45" }).success).toBe(false);
  });
});
