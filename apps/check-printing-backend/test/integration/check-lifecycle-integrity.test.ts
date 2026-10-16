import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createApprovalRule, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";
import { CheckRepository } from "../../src/modules/check/check.repository.js";

// Phase 0.2 (edits and deletes cannot land on a check that moved on) and
// Phase 0.5 (reissue integrity).

describe("draft edits and deletes", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: true });
    // Approval is on but this rule only covers large amounts, so checks start as NEW drafts.
    await createApprovalRule(world, { minAmount: 0, approvers: [world.approver1] });
    await prisma.checkPrintingSettings.update({
      where: { workspaceId: world.workspaceId },
      data: { approvalEnabled: false },
    });
  });

  async function createDraft(): Promise<string> {
    const res = await checksApi(world, world.editor).create();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("NEW");
    return res.body.data.id;
  }

  it("an edit that arrives after the check was submitted is refused and changes nothing", async () => {
    const checkId = await createDraft();
    const repo = new CheckRepository();

    // The service validated the edit while the check was NEW; then a submit won the race.
    await prisma.check.update({ where: { id: checkId }, data: { status: "PENDING_APPROVAL" } });

    await expect(
      repo.updateDraft(checkId, world.workspaceId, world.editor.id, ["NEW", "REJECTED"], {
        amount: 49999,
        amountInWords: "Forty-nine thousand nine hundred ninety-nine and 00/100",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
    expect(Number(check.amount)).toBe(1250.5);
  });

  it("an edit racing a submit never changes a submitted check", async () => {
    const checkId = await createDraft();
    // Submitting only makes sense when the check needs approval (a check no rule covers is
    // refused: no approver would ever see it). Turn approval on after the draft exists.
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { minAmount: 0, approvers: [world.approver1] });
    const editor = checksApi(world, world.editor);
    const original = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });

    for (let i = 0; i < 5; i++) {
      await prisma.check.update({
        where: { id: checkId },
        data: { status: "NEW", amount: 1250.5, amountInWords: original.amountInWords },
      });
      const [edit, submit] = await Promise.all([
        editor.update(checkId, { amount: 777 }),
        editor.submit(checkId),
      ]);
      expect(submit.status).toBe(200);
      expect([200, 400, 409]).toContain(edit.status);

      // Whatever the interleaving, a successful edit must have happened while the check
      // was still a draft, so the submitted check carries either the old or new amount
      // consistently in both the amount and the stored words.
      const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
      expect(check.status).toBe("PENDING_APPROVAL");
      const words = Number(check.amount) === 777 ? /Seven hundred seventy-seven/i : /One thousand two hundred fifty/i;
      expect(check.amountInWords).toMatch(words);
    }
  });

  it("only the creator can edit a draft", async () => {
    const checkId = await createDraft();
    const res = await checksApi(world, world.admin).update(checkId, { amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/only edit checks you created/);
  });

  it("a delete racing a submit leaves a submitted check undeleted", async () => {
    const checkId = await createDraft();
    const repo = new CheckRepository();
    await prisma.check.update({ where: { id: checkId }, data: { status: "PENDING_APPROVAL" } });

    await expect(repo.softDeleteDraft(checkId, world.workspaceId, world.editor.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
    expect(check.deletedAt).toBeNull();
  });

  it("a draft can still be edited and deleted normally", async () => {
    const checkId = await createDraft();
    const editor = checksApi(world, world.editor);

    const edited = await editor.update(checkId, { amount: 300.25, memo: "Invoice 4471" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.amount).toBe("300.25");
    expect(edited.body.data.amountInWords).toMatch(/Three hundred and 25\/100/i);

    expect((await editor.remove(checkId)).status).toBe(204);
    expect((await editor.get(checkId)).status).toBe(404);
  });
});

describe("reissue", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: false });
  });

  async function createVoidedCheck(): Promise<{ id: string; checkNumber: number }> {
    const created = await checksApi(world, world.editor).create();
    expect(created.status).toBe(201);
    // Only printed checks can be voided. Printing is covered in pdf-integrity.test.ts.
    await prisma.check.update({ where: { id: created.body.data.id }, data: { status: "PRINTED" } });
    const voided = await checksApi(world, world.admin).void(created.body.data.id);
    expect(voided.status).toBe(200);
    return { id: created.body.data.id, checkNumber: created.body.data.checkNumber };
  }

  it("records the original check number in the new check's history", async () => {
    const original = await createVoidedCheck();
    const res = await checksApi(world, world.editor).reissue(original.id);

    expect(res.status).toBe(201);
    expect(res.body.data.checkNumber).toBe(original.checkNumber + 1);
    expect(res.body.data.reissuedFrom).toEqual({ id: original.id, checkNumber: original.checkNumber });

    const history = await prisma.checkStatusHistory.findFirstOrThrow({ where: { checkId: res.body.data.id } });
    expect(history.reason).toBe(`Reissue of voided check #${original.checkNumber}`);
  });

  it("a second reissue of the same check is refused with 409 and names the replacement", async () => {
    const original = await createVoidedCheck();
    const first = await checksApi(world, world.editor).reissue(original.id);
    expect(first.status).toBe(201);

    const second = await checksApi(world, world.editor).reissue(original.id);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain(`#${first.body.data.checkNumber}`);
  });

  it("concurrent reissues of one check create exactly one replacement", async () => {
    const original = await createVoidedCheck();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => checksApi(world, world.editor).reissue(original.id)),
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body.error.message).toMatch(/already been reissued/);
    }
    expect(await prisma.check.count({ where: { reissuedFromCheckId: original.id } })).toBe(1);
  });

  it("refuses to reissue onto a bank account that was deactivated", async () => {
    const original = await createVoidedCheck();
    await prisma.bankAccount.update({ where: { id: world.bankAccountId }, data: { isActive: false } });

    const res = await checksApi(world, world.editor).reissue(original.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/inactive or no longer exists/);
    expect(await prisma.check.count({ where: { reissuedFromCheckId: original.id } })).toBe(0);
  });
});
