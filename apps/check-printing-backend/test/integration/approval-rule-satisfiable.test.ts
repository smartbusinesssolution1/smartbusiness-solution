import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { ROLES } from "../../src/shared/constants/rbac.js";

// R-20: an active approval rule must always have at least `requiredApprovals` people who can
// approve (active members with the Approver or Admin role; only the designated ones when the
// rule names approvers). Otherwise every check matching it waits for approval forever.
//
// The fixture world has three such people: admin, approver1, approver2.

function rulesApi(world: TestWorld) {
  const base = `/api/v1/workspaces/${world.workspaceId}/approval-rules`;
  const headers = authHeaders(world.admin);
  return {
    create: (body: Record<string, unknown>) => request(getApp()).post(base).set(headers).send({ minAmount: 1000, ...body }),
    update: (id: string, body: Record<string, unknown>) => request(getApp()).put(`${base}/${id}`).set(headers).send(body),
    activate: (id: string) => request(getApp()).post(`${base}/${id}/activate`).set(headers).send({}),
    sync: (id: string, users: TestUser[]) =>
      request(getApp()).put(`${base}/${id}/approvers`).set(headers).send({ userIds: users.map((u) => u.id) }),
    add: (id: string, user: TestUser) => request(getApp()).post(`${base}/${id}/approvers`).set(headers).send({ userId: user.id }),
    remove: (id: string, user: TestUser) => request(getApp()).delete(`${base}/${id}/approvers/${user.id}`).set(headers),
  };
}

function membersApi(world: TestWorld) {
  const base = `/api/v1/workspaces/${world.workspaceId}/members`;
  const headers = authHeaders(world.admin);
  return {
    update: (memberId: string, roleSlugs: string[]) => request(getApp()).put(`${base}/${memberId}`).set(headers).send({ roleSlugs }),
    remove: (memberId: string) => request(getApp()).delete(`${base}/${memberId}`).set(headers),
  };
}

const memberIdOf = async (world: TestWorld, user: TestUser) =>
  (await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: user.id } })).id;

describe("approval rules that can always be satisfied (R-20)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("a rule without designated approvers (anyone who can approve)", () => {
    it("may require as many approvals as there are people who can approve", async () => {
      expect((await rulesApi(world).create({ requiredApprovals: 3 })).status).toBe(201);
    });

    it("cannot require more", async () => {
      const res = await rulesApi(world).create({ requiredApprovals: 4 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/needs 4 approvals but only 3/);
      expect(await prisma.approvalWorkflowRule.count()).toBe(0);
    });

    it("cannot be raised above that later", async () => {
      const id = (await rulesApi(world).create({ requiredApprovals: 2 })).body.data.id;

      const res = await rulesApi(world).update(id, { requiredApprovals: 4 });

      expect(res.status).toBe(400);
      expect((await prisma.approvalWorkflowRule.findUniqueOrThrow({ where: { id } })).requiredApprovals).toBe(2);
    });
  });

  describe("a rule with designated approvers", () => {
    let ruleId: string;

    beforeEach(async () => {
      ruleId = (await rulesApi(world).create({ requiredApprovals: 2 })).body.data.id;
    });

    it("needs at least as many designated approvers as required approvals", async () => {
      expect((await rulesApi(world).sync(ruleId, [world.approver1])).status).toBe(400);
      expect((await rulesApi(world).sync(ruleId, [world.approver1, world.approver2])).status).toBe(200);
    });

    it("naming a first designated approver cannot shrink the pool below the requirement", async () => {
      // Open rule needing 2 of 3; naming only one person would leave just that one.
      const res = await rulesApi(world).add(ruleId, world.approver1);

      expect(res.status).toBe(400);
      expect(await prisma.approvalWorkflowApprover.count({ where: { ruleId } })).toBe(0);
    });

    it("cannot lose a designated approver it needs", async () => {
      await rulesApi(world).sync(ruleId, [world.approver1, world.approver2]);

      const res = await rulesApi(world).remove(ruleId, world.approver2);

      expect(res.status).toBe(400);
      expect(await prisma.approvalWorkflowApprover.count({ where: { ruleId } })).toBe(2);
    });
  });

  describe("an inactive rule", () => {
    it("may be unsatisfiable while inactive, but cannot be activated that way", async () => {
      const ruleId = await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1] });
      await prisma.approvalWorkflowRule.update({ where: { id: ruleId }, data: { isActive: false } });

      const res = await rulesApi(world).activate(ruleId);

      expect(res.status).toBe(400);
      expect((await prisma.approvalWorkflowRule.findUniqueOrThrow({ where: { id: ruleId } })).isActive).toBe(false);
    });
  });

  describe("member changes", () => {
    let ruleId: string;

    beforeEach(async () => {
      ruleId = await createApprovalRule(world, { requiredApprovals: 2, approvers: [world.approver1, world.approver2] });
    });

    it("removing an approver a rule needs is refused, naming the rule", async () => {
      const res = await membersApi(world).remove(await memberIdOf(world, world.approver2));

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/approval rule/i);
      expect(res.body.error.message).toMatch(/\$0\.00 and above/);
      const member = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: world.approver2.id } });
      expect(member.deletedAt).toBeNull();
    });

    it("taking away the approver role a rule needs is refused", async () => {
      const res = await membersApi(world).update(await memberIdOf(world, world.approver2), [ROLES.VIEWER]);

      expect(res.status).toBe(409);
      const roles = await prisma.workspaceMemberRole.findMany({
        where: { workspaceMember: { userId: world.approver2.id } },
        include: { role: true },
      });
      expect(roles.map((r) => r.role.slug)).toEqual([ROLES.APPROVER]);
    });

    it("changes that do not affect any rule still work", async () => {
      expect((await membersApi(world).remove(await memberIdOf(world, world.viewer))).status).toBe(204);
      expect((await membersApi(world).update(await memberIdOf(world, world.printer), [ROLES.EDITOR])).status).toBe(200);
    });

    it("a rule that was already unsatisfiable does not block unrelated member changes", async () => {
      await createApprovalRule(world, { requiredApprovals: 5, minAmount: 50_000 }); // broken before this fix

      expect((await membersApi(world).remove(await memberIdOf(world, world.viewer))).status).toBe(204);
    });

    it("an inactive rule does not block member changes", async () => {
      await prisma.approvalWorkflowRule.update({ where: { id: ruleId }, data: { isActive: false } });

      expect((await membersApi(world).remove(await memberIdOf(world, world.approver2))).status).toBe(204);
    });
  });
});
