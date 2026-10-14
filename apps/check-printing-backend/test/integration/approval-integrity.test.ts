import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createApprovalRule, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";

// Phase 0.1: an approval vote must count exactly once, and only toward the
// version of the check it was cast on.

describe("approval integrity", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: true });
  });

  async function createPendingCheck(amount = 1250.5): Promise<string> {
    const res = await checksApi(world, world.editor).create({ amount });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING_APPROVAL");
    return res.body.data.id;
  }

  it("two approvers voting at the same moment approve a 2-approval check exactly once", async () => {
    await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1, world.approver2] });
    const checkId = await createPendingCheck();

    const [a, b] = await Promise.all([
      checksApi(world, world.approver1).approve(checkId),
      checksApi(world, world.approver2).approve(checkId),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
    expect(check.status).toBe("APPROVED");
    expect(await prisma.approvalRecord.count({ where: { checkId } })).toBe(2);
    expect(await prisma.checkStatusHistory.count({ where: { checkId, toStatus: "APPROVED" } })).toBe(1);
  });

  it("one approver clicking approve several times at once casts one vote", async () => {
    await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1, world.approver2] });
    const checkId = await createPendingCheck();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => checksApi(world, world.approver1).approve(checkId)),
    );
    const statuses = results.map((r) => r.status).sort();

    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body.error.message).toMatch(/already submitted a decision/);
    }

    // One vote of the two required: the check must still be waiting.
    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
    expect(check.status).toBe("PENDING_APPROVAL");
    expect(await prisma.approvalRecord.count({ where: { checkId } })).toBe(1);
  });

  it("a second vote by the same approver is refused with 409", async () => {
    await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1, world.approver2] });
    const checkId = await createPendingCheck();

    expect((await checksApi(world, world.approver1).approve(checkId)).status).toBe(200);
    const again = await checksApi(world, world.approver1).approve(checkId);

    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already submitted a decision/);
  });

  it("votes cast before a rejection and edit do not count toward the resubmitted check", async () => {
    await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1, world.approver2] });
    const checkId = await createPendingCheck(1000);
    const editor = checksApi(world, world.editor);

    // Round 1: approver1 approves, approver2 rejects.
    expect((await checksApi(world, world.approver1).approve(checkId)).status).toBe(200);
    expect((await checksApi(world, world.approver2).reject(checkId, "Amount looks wrong")).status).toBe(200);

    // The creator raises the amount and resubmits: round 2.
    expect((await editor.update(checkId, { amount: 9000 })).status).toBe(200);
    const resubmitted = await editor.resubmit(checkId);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data.approval.round).toBe(2);
    expect(resubmitted.body.data.approval.approvedCount).toBe(0);

    // approver1's round-1 approval must not count: one new vote is not enough.
    const first = await checksApi(world, world.approver2).approve(checkId);
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("PENDING_APPROVAL");
    expect(first.body.data.approval.approvedCount).toBe(1);

    const second = await checksApi(world, world.approver1).approve(checkId);
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe("APPROVED");

    const decisions = second.body.data.approval.decisions as Array<{ round: number; decision: string }>;
    expect(decisions.map((d) => [d.round, d.decision])).toEqual([
      [1, "approved"],
      [1, "rejected"],
      [2, "approved"],
      [2, "approved"],
    ]);
  });

  it("the approver who rejected sees the resubmitted check in their queue again", async () => {
    await createApprovalRule(world, { requiredApprovals: 1, approvers: [world.approver1] });
    const checkId = await createPendingCheck();
    const approver = checksApi(world, world.approver1);

    expect((await approver.reject(checkId)).status).toBe(200);
    expect((await approver.approvalQueue()).body.data).toHaveLength(0);

    expect((await checksApi(world, world.editor).resubmit(checkId)).status).toBe(200);

    const queue = await approver.approvalQueue();
    expect(queue.body.data.map((c: { id: string }) => c.id)).toEqual([checkId]);
    expect((await approver.approve(checkId)).status).toBe(200);
  });

  it("with the approval workflow off, a second person approves a draft directly", async () => {
    await prisma.checkPrintingSettings.update({
      where: { workspaceId: world.workspaceId },
      data: { approvalEnabled: false },
    });
    const created = await checksApi(world, world.editor).create();
    expect(created.body.data.status).toBe("NEW");

    const res = await checksApi(world, world.approver1).approve(created.body.data.id);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");

    const history = await prisma.checkStatusHistory.findFirstOrThrow({
      where: { checkId: created.body.data.id, toStatus: "APPROVED" },
    });
    expect(history.fromStatus).toBe("NEW");
  });

  it("a vote racing a rejection never approves a rejected check", async () => {
    await createApprovalRule(world, { requiredApprovals: 1, approvers: [world.approver1, world.approver2] });
    const checkId = await createPendingCheck();

    const [approve, reject] = await Promise.all([
      checksApi(world, world.approver1).approve(checkId),
      checksApi(world, world.approver2).reject(checkId),
    ]);

    // Exactly one decision wins; the other sees that the check moved on.
    expect([approve.status, reject.status].sort()).toEqual([200, 409]);
    const check = await prisma.check.findUniqueOrThrow({ where: { id: checkId } });
    const history = await prisma.checkStatusHistory.findMany({
      where: { checkId, toStatus: { in: ["APPROVED", "REJECTED"] } },
    });
    expect(history).toHaveLength(1);
    expect(history[0]!.toStatus).toBe(check.status);
  });
});
