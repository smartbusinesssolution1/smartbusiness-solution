import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@smartbusiness/database";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createPrinterProfile, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

// ═══════════════════════════════════════════════════════════════
// VALIDATION RULES R-01 – R-12 (sprint P2: "validation rules client + server")
//
// One section per rule, each testing both sides of its boundary through the
// real API. The rules are our assumed versions from DEVELOPER_BIBLE.md §19;
// the client's CRD v2.0 has not been received (status: pending CRD).
//
// Rule  Where it is enforced                                   Layer
// R-01  check.schemas.ts payeeNameSchema .min(1) after trim    schema
// R-02  check.schemas.ts payeeNameSchema .max(200) + fits on   schema  (stricter than 255:
//       the check (text-fit.ts payeeFitsOnCheck)                        a payee is never truncated)
// R-03  check.schemas.ts moneySchema .positive()               schema
// R-04  moneySchema .max(999,999.99) + workspace limit in      schema + service
//       check.service.ts assertAmountWithinLimit
// R-05  moneySchema hasAtMostTwoDecimals (whole cents)         schema
// R-06  check.service.ts assertDateWithinRange (maxPastDays)   service
// R-07  check.service.ts assertDateWithinRange (maxFutureDays) service
// R-08  bank-account.schema.ts routingNumberSchema (ABA)       schema
// R-09  bank-account.schema.ts accountNumber 4–17 digits       schema
// R-10  schema.prisma @@unique([bankAccountId, checkNumber])   database
//       + atomic numbering in check.repository.ts insertCheck
// R-11  check.service.ts requireActiveBankAccount              service (+ database
//                                                                       condition on insert)
// R-12  check.schemas.ts memoSchema .max(255)                  schema
// ═══════════════════════════════════════════════════════════════

/** A date `offset` days from today, as the API expects it (YYYY-MM-DD, UTC). */
function day(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function errorText(res: request.Response): string {
  return JSON.stringify(res.body.error ?? {});
}

describe("validation rules R-01 – R-12", () => {
  let world: TestWorld;
  let checks: ReturnType<typeof checksApi>;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld(); // workspace limits: max $50,000, 30 days back, 90 days ahead
    checks = checksApi(world, world.editor);
  });

  const createBankAccount = (body: Record<string, unknown>) =>
    request(getApp())
      .post(`/api/v1/workspaces/${world.workspaceId}/bank-accounts`)
      .set(authHeaders(world.admin))
      .send({
        routingNumber: "026009593",
        accountNumber: "123456785678",
        accountType: "CHECKING",
        startingCheckNumber: 2001,
        ...body,
      });

  describe("R-01 payee name must not be empty", () => {
    it.each([
      ["an empty name", ""],
      ["only spaces", "     "],
    ])("rejects %s", async (_label, payeeName) => {
      const res = await checks.create({ payeeName });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/Payee name is required/);
    });

    it("accepts a one-character name", async () => {
      expect((await checks.create({ payeeName: "A" })).status).toBe(201);
    });

    it("trims surrounding spaces before saving", async () => {
      const res = await checks.create({ payeeName: "  ABC Supplies  " });
      expect(res.body.data.payeeName).toBe("ABC Supplies");
    });
  });

  describe("R-02 payee name length (stricter: must also fit on the printed check)", () => {
    it("accepts a long name that fits on one line", async () => {
      expect((await checks.create({ payeeName: "Austin Equipment Rental & Supply Inc." })).status).toBe(201);
    });

    it("rejects a name that would have to be truncated on the check", async () => {
      const res = await checks.create({
        payeeName: "The Extraordinarily Long Named Landscaping and Irrigation Services Company of Central Texas LLC",
      });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/too long to fit on one line/);
    });

    it("rejects more than 200 characters", async () => {
      expect((await checks.create({ payeeName: "W".repeat(201) })).status).toBe(400);
    });
  });

  describe("R-03 amount must be greater than $0.00", () => {
    it.each([0, -0.01, -500])("rejects %d", async (amount) => {
      const res = await checks.create({ amount });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/greater than zero/);
    });

    it("accepts the smallest amount, $0.01", async () => {
      const res = await checks.create({ amount: 0.01 });
      expect(res.status).toBe(201);
      expect(res.body.data.amountInWords).toBe("Zero and 01/100");
    });
  });

  describe("R-04 amount must not exceed the maximum", () => {
    it("accepts exactly the workspace limit, $50,000.00", async () => {
      expect((await checks.create({ amount: 50000 })).status).toBe(201);
    });

    it("rejects one cent over the workspace limit", async () => {
      const res = await checks.create({ amount: 50000.01 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Amount exceeds maximum of $50,000.00");
    });

    it("rejects an edit that raises the amount over the limit", async () => {
      const created = await checks.create({ amount: 100 });
      const res = await checks.update(created.body.data.id, { amount: 50000.01 });
      expect(res.status).toBe(400);
    });

    it("rejects anything over the absolute maximum of $999,999.99", async () => {
      await prisma.checkPrintingSettings.update({
        where: { workspaceId: world.workspaceId },
        data: { maxCheckAmount: 999999.99 },
      });
      expect((await checks.create({ amount: 999999.99 })).status).toBe(201);
      const res = await checks.create({ amount: 1000000 });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/cannot exceed \$999,999\.99/);
    });
  });

  describe("R-05 amount must be in whole cents (2 decimal places)", () => {
    it.each([10.999, 10.001, 0.125])("rejects %d", async (amount) => {
      const res = await checks.create({ amount });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/whole cents/);
    });

    it.each([
      [10, "10.00"],
      [10.5, "10.50"],
      [10.99, "10.99"],
    ])("accepts %d and stores it as %s", async (amount, stored) => {
      const res = await checks.create({ amount });
      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(stored);
    });
  });

  describe("R-06 check date at most 30 days in the past (workspace setting)", () => {
    it("accepts exactly 30 days ago", async () => {
      expect((await checks.create({ checkDate: day(-30) })).status).toBe(201);
    });

    it("rejects 31 days ago", async () => {
      const res = await checks.create({ checkDate: day(-31) });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Check date cannot be more than 30 days in the past");
    });

    it("follows the workspace's own setting", async () => {
      await prisma.checkPrintingSettings.update({
        where: { workspaceId: world.workspaceId },
        data: { maxPastDays: 5 },
      });
      expect((await checks.create({ checkDate: day(-5) })).status).toBe(201);
      expect((await checks.create({ checkDate: day(-6) })).status).toBe(400);
    });
  });

  describe("R-07 check date at most 90 days in the future (workspace setting)", () => {
    it("accepts exactly 90 days ahead", async () => {
      expect((await checks.create({ checkDate: day(90) })).status).toBe(201);
    });

    it("rejects 91 days ahead", async () => {
      const res = await checks.create({ checkDate: day(91) });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Check date cannot be more than 90 days in the future");
    });

    it("rejects an edit that moves the date out of range", async () => {
      const created = await checks.create();
      expect((await checks.update(created.body.data.id, { checkDate: day(91) })).status).toBe(400);
    });
  });

  describe("R-08 routing number must pass the ABA checksum", () => {
    it("rejects a routing number with a wrong check digit", async () => {
      const res = await createBankAccount({ routingNumber: "026009594" });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/not a valid ABA routing number/);
    });

    it.each(["02600959", "0260095930", "02600959A"])("rejects a malformed routing number %s", async (routingNumber) => {
      expect((await createBankAccount({ routingNumber })).status).toBe(400);
    });

    it("accepts a valid routing number", async () => {
      expect((await createBankAccount({ routingNumber: "026009593" })).status).toBe(201);
    });
  });

  describe("R-09 account number must not be empty (4–17 digits)", () => {
    it.each([
      ["empty", ""],
      ["too short", "123"],
      ["too long", "123456789012345678"],
      ["not digits", "12AB5678"],
    ])("rejects an account number that is %s", async (_label, accountNumber) => {
      expect((await createBankAccount({ accountNumber })).status).toBe(400);
    });

    it.each(["1234", "12345678901234567"])("accepts %s", async (accountNumber) => {
      expect((await createBankAccount({ accountNumber })).status).toBe(201);
    });
  });

  describe("R-10 check number must be unique per bank account", () => {
    it("gives simultaneous checks consecutive, distinct numbers", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => checks.create()));
      expect(results.every((r) => r.status === 201)).toBe(true);

      const numbers = results.map((r) => r.body.data.checkNumber as number).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers[5]! - numbers[0]!).toBe(5);
    });

    it("is enforced by the database itself, not only by our code", async () => {
      const first = await checks.create();
      const duplicate = prisma.check.create({
        data: {
          workspaceId: world.workspaceId,
          bankAccountId: world.bankAccountId,
          checkNumber: first.body.data.checkNumber,
          payeeName: "Duplicate",
          amount: 1,
          amountInWords: "One and 00/100",
          checkDate: new Date(),
          createdById: world.editor.id,
        },
      });
      await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
    });

    it("allows the same number on a different bank account", async () => {
      const other = await createBankAccount({ startingCheckNumber: 1001 });
      const a = await checks.create();
      const b = await checks.create({ bankAccountId: other.body.data.id });
      expect(a.body.data.checkNumber).toBe(1001);
      expect(b.body.data.checkNumber).toBe(1001);
    });
  });

  describe("R-11 bank account must be active", () => {
    const deactivate = () =>
      prisma.bankAccount.update({ where: { id: world.bankAccountId }, data: { isActive: false } });

    it("refuses a new check on an inactive account with a clear message", async () => {
      await deactivate();
      const res = await checks.create();
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(
        "The bank account JPMorgan Chase ****1012 is inactive, so you can't write checks from it. An admin can reactivate it.",
      );
    });

    it("answers 404, not 'inactive', for an account that does not exist", async () => {
      await prisma.bankAccount.update({ where: { id: world.bankAccountId }, data: { deletedAt: new Date() } });
      const res = await checks.create();
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Bank account not found");
    });

    it("refuses to print a check whose account was deactivated after it was written", async () => {
      await createPrinterProfile(world);
      const created = await checks.create();
      await prisma.check.update({ where: { id: created.body.data.id }, data: { status: "APPROVED" } });
      await deactivate();

      const res = await checksApi(world, world.printer).print(created.body.data.id);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/is inactive, so you can't print check #1001/);
    });

    it("works again once the account is reactivated", async () => {
      await deactivate();
      await prisma.bankAccount.update({ where: { id: world.bankAccountId }, data: { isActive: true } });
      expect((await checks.create()).status).toBe(201);
    });
  });

  describe("R-12 memo must not exceed 255 characters", () => {
    it("accepts exactly 255 characters", async () => {
      const res = await checks.create({ memo: "m".repeat(255) });
      expect(res.status).toBe(201);
      expect(res.body.data.memo).toHaveLength(255);
    });

    it("rejects 256 characters", async () => {
      const res = await checks.create({ memo: "m".repeat(256) });
      expect(res.status).toBe(400);
      expect(errorText(res)).toMatch(/Memo cannot be longer than 255 characters/);
    });

    it("counts characters after trimming surrounding spaces", async () => {
      expect((await checks.create({ memo: `  ${"m".repeat(255)}  ` })).status).toBe(201);
    });

    it("applies the same limit when editing", async () => {
      const created = await checks.create();
      expect((await checks.update(created.body.data.id, { memo: "m".repeat(256) })).status).toBe(400);
      expect((await checks.update(created.body.data.id, { memo: "m".repeat(255) })).status).toBe(200);
    });

    it("lets a memo be cleared", async () => {
      const created = await checks.create({ memo: "Invoice 4471" });
      const res = await checks.update(created.body.data.id, { memo: null });
      expect(res.status).toBe(200);
      expect(res.body.data.memo).toBeNull();
    });
  });
});
