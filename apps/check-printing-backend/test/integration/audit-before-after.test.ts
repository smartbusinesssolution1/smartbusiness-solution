import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// #4: edits record what each changed field was before and what it became, so the log
// answers "changed from what?".

const lastEntry = async (action: string) =>
  (await prisma.auditLog.findFirstOrThrow({ where: { action }, orderBy: { createdAt: "desc" } })).detailsJson as Record<string, unknown>;

describe("audit log records before → after", () => {
  let world: TestWorld;
  const base = () => `/api/v1/workspaces/${world.workspaceId}`;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  it("editing a draft check: only the fields that changed, with their old values", async () => {
    const check = await prisma.check.create({
      data: {
        workspaceId: world.workspaceId,
        bankAccountId: world.bankAccountId,
        checkNumber: 1001,
        status: "NEW",
        payeeName: "Lala Company",
        amount: 500,
        amountInWords: "words",
        checkDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
        createdById: world.editor.id,
      },
    });
    const res = await request(getApp())
      .put(`${base()}/checks/${check.id}`)
      .set(authHeaders(world.editor))
      .send({ amount: 5000, memo: "Invoice 778", payeeName: "Lala Company" });

    expect(res.status).toBe(200);
    expect((await lastEntry("CHECK_UPDATED")).changes).toEqual({
      amount: { from: "500.00", to: "5000.00" },
      memo: { from: null, to: "Invoice 778" },
    });
    // The payee was sent unchanged, so it is not listed; the date wasn't sent at all.
  });

  it("editing a bank account: the changed settings, never account or routing numbers", async () => {
    const res = await request(getApp())
      .put(`${base()}/bank-accounts/${world.bankAccountId}`)
      .set(authHeaders(world.admin))
      .send({ isActive: false, checkNumberPadding: 8, accountType: "CHECKING" });

    expect(res.status).toBe(200);
    const details = await lastEntry("BANK_ACCOUNT_UPDATED");
    expect(details.changes).toEqual({ isActive: { from: true, to: false }, checkNumberPadding: { from: 6, to: 8 } });
    expect(JSON.stringify(details)).not.toMatch(/987654321012|111000025|Encrypted/);
  });

  it("editing the business details printed on checks: the old address is kept", async () => {
    const before = await prisma.workspace.update({ where: { id: world.workspaceId }, data: { phone: "(512) 555-0100" } });

    const res = await request(getApp())
      .put(base())
      .set(authHeaders(world.admin))
      .send({ addressLine1: "PO Box 666", businessName: before.businessName, phone: "" });

    expect(res.status).toBe(200);
    const changes = (await lastEntry("WORKSPACE_UPDATED")).changes as Record<string, unknown>;
    expect(changes.addressLine1).toEqual({ from: before.addressLine1, to: "PO Box 666" });
    expect(changes).not.toHaveProperty("businessName");
    // "" clears the phone: recorded as the old number → nothing.
    expect(changes.phone).toEqual({ from: "(512) 555-0100", to: null });
  });

  it("editing an approval rule: every changed field, money as 1250.50", async () => {
    const ruleId = await createApprovalRule(world, { minAmount: 1000, maxAmount: null, requiredApprovals: 1 });

    const res = await request(getApp())
      .put(`${base()}/approval-rules/${ruleId}`)
      .set(authHeaders(world.admin))
      .send({ minAmount: 2500.5, maxAmount: 10000, priority: 1 });

    expect(res.status).toBe(200);
    expect((await lastEntry("APPROVAL_RULE_UPDATED")).changes).toEqual({
      minAmount: { from: "1000.00", to: "2500.50" },
      maxAmount: { from: null, to: "10000.00" },
    });
  });
});
