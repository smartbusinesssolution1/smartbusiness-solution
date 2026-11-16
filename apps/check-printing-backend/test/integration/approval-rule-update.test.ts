import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

// BUG_042: clearing "Up to" on an existing rule must remove its upper limit. The form now
// sends maxAmount: null for that; a field left out means "keep the current value".

function rulesApi(world: TestWorld) {
  const base = `/api/v1/workspaces/${world.workspaceId}/approval-rules`;
  const headers = authHeaders(world.admin);
  return {
    create: (body: Record<string, unknown>) => request(getApp()).post(base).set(headers).send(body),
    update: (id: string, body: Record<string, unknown>) => request(getApp()).put(`${base}/${id}`).set(headers).send(body),
  };
}

describe("editing an approval rule's upper limit", () => {
  let world: TestWorld;
  let ruleId: string;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld({ approvalEnabled: true });
    const res = await rulesApi(world).create({ minAmount: 1000, maxAmount: 5000 });
    expect(res.status).toBe(201);
    ruleId = res.body.data.id;
  });

  it("maxAmount: null removes the upper limit", async () => {
    const res = await rulesApi(world).update(ruleId, { minAmount: 1000, maxAmount: null, requiredApprovals: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.maxAmount).toBeNull();
    const saved = await prisma.approvalWorkflowRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(saved.maxAmount).toBeNull();
  });

  it("once the limit is removed, a check above the old maximum needs approval", async () => {
    const before = await checksApi(world, world.editor).create({ amount: 8000, checkDate: today() });
    expect(before.body.data.status).toBe("NEW");

    await rulesApi(world).update(ruleId, { maxAmount: null });

    const after = await checksApi(world, world.editor).create({ amount: 8000, checkDate: today() });
    expect(after.status).toBe(201);
    expect(after.body.data.status).toBe("PENDING_APPROVAL");
  });

  it("leaving maxAmount out keeps the current limit (partial update)", async () => {
    const res = await rulesApi(world).update(ruleId, { requiredApprovals: 2 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.maxAmount)).toBe(5000);
  });
});
