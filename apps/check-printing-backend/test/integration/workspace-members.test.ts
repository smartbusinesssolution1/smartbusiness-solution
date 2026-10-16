import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { PasswordService } from "@smartbusiness/auth";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { PRODUCT_SLUG, ROLES } from "../../src/shared/constants/rbac.js";
import { WorkspaceService } from "../../src/modules/workspace/workspace.service.js";
import { WorkspaceRepository } from "../../src/modules/workspace/workspace.repository.js";
import { AuditService } from "../../src/shared/services/audit.service.js";

// R-02: removing a member left their role rows behind; re-adding them appended new roles, so a
// former Editor re-added as Viewer could still write checks (and a re-add with the same role
// hit the unique index: 409).
// R-38: editing someone's Check Printing roles deleted their roles in every product.
// R-21: the last-admin rule was "count, then change", so two admins demoting or removing each
// other at the same moment could leave the workspace with none.

function membersApi(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/members`;
  const headers = authHeaders(user);
  return {
    list: () => request(getApp()).get(base).set(headers),
    add: (who: TestUser, roleSlugs: string[]) =>
      request(getApp()).post(base).set(headers).send({ email: who.email, fullName: "Re-added Person", roleSlugs }),
    update: (memberId: string, roleSlugs: string[]) =>
      request(getApp()).put(`${base}/${memberId}`).set(headers).send({ roleSlugs }),
    remove: (memberId: string) => request(getApp()).delete(`${base}/${memberId}`).set(headers),
  };
}

const memberIdOf = async (world: TestWorld, user: TestUser) =>
  (await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: user.id } })).id;

// Every role row the person holds in the workspace, from any product, sorted for comparison.
const rolesOf = async (world: TestWorld, user: TestUser) =>
  (
    await prisma.workspaceMemberRole.findMany({
      where: { workspaceMember: { workspaceId: world.workspaceId, userId: user.id } },
      include: { role: true },
    })
  )
    .map((r) => r.role.slug)
    .sort();

const isActiveMember = async (world: TestWorld, user: TestUser) =>
  (await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: user.id } }))
    .deletedAt === null;

// A second product on the platform (Clock In/Out) with one role, as it will exist later.
async function giveClockRole(world: TestWorld, user: TestUser): Promise<void> {
  const product =
    (await prisma.product.findUnique({ where: { slug: "clock-in-out" } })) ??
    (await prisma.product.create({ data: { slug: "clock-in-out", name: "Clock In/Out" } }));
  const role =
    (await prisma.role.findFirst({ where: { productId: product.id, slug: "clock-manager" } })) ??
    (await prisma.role.create({ data: { productId: product.id, slug: "clock-manager", name: "Clock manager" } }));
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: await memberIdOf(world, user), roleId: role.id } });
}

async function giveCheckRole(world: TestWorld, user: TestUser, slug: string): Promise<void> {
  const role = await prisma.role.findFirstOrThrow({ where: { slug, product: { slug: PRODUCT_SLUG } } });
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: await memberIdOf(world, user), roleId: role.id } });
}

const activeAdminCount = (world: TestWorld) =>
  prisma.workspaceMemberRole.count({
    where: { role: { slug: ROLES.ADMIN }, workspaceMember: { workspaceId: world.workspaceId, deletedAt: null } },
  });

describe("workspace members", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("removing and re-adding a member (R-02)", () => {
    it("someone removed as Editor and re-added as Viewer is only a Viewer", async () => {
      const api = membersApi(world, world.admin);
      await api.remove(await memberIdOf(world, world.editor));

      const readd = await api.add(world.editor, [ROLES.VIEWER]);

      expect(readd.status).toBe(201);
      expect(readd.body.data.roles).toEqual([ROLES.VIEWER]);
      expect(await rolesOf(world, world.editor)).toEqual([ROLES.VIEWER]);

      const check = await request(getApp())
        .post(`/api/v1/workspaces/${world.workspaceId}/checks`)
        .set(authHeaders(world.editor))
        .send({ bankAccountId: world.bankAccountId, payeeName: "Hill Country Supply Co.", amount: 10, checkDate: today() });
      expect(check.status).toBe(403);
    });

    it("someone can be re-added with the same role they had", async () => {
      const api = membersApi(world, world.admin);
      await api.remove(await memberIdOf(world, world.printer));

      const readd = await api.add(world.printer, [ROLES.PRINTER]);

      expect(readd.status).toBe(201);
      expect(await rolesOf(world, world.printer)).toEqual([ROLES.PRINTER]);
    });

    it("removal takes away the Check Printing roles and records them in the audit log", async () => {
      const res = await membersApi(world, world.admin).remove(await memberIdOf(world, world.editor));

      expect(res.status).toBe(204);
      expect(await rolesOf(world, world.editor)).toEqual([]);
      expect(await isActiveMember(world, world.editor)).toBe(false);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_REMOVED" } });
      expect(audit.detailsJson).toMatchObject({ roleSlugs: [ROLES.EDITOR], leftWorkspace: true });
    });

    // Removals made before this fix only stamped deletedAt and left the role rows behind
    // (they exist in databases today). Re-adding such a member must not bring them back.
    it("a member removed by the old code, roles left behind, is re-added with only the new roles", async () => {
      await prisma.workspaceMember.update({
        where: { id: await memberIdOf(world, world.editor) },
        data: { deletedAt: new Date() },
      });
      expect(await rolesOf(world, world.editor)).toEqual([ROLES.EDITOR]);

      const readd = await membersApi(world, world.admin).add(world.editor, [ROLES.VIEWER]);

      expect(readd.status).toBe(201);
      expect(await rolesOf(world, world.editor)).toEqual([ROLES.VIEWER]);
    });

    it("a removed member can no longer use the workspace", async () => {
      await membersApi(world, world.admin).remove(await memberIdOf(world, world.viewer));

      const res = await request(getApp())
        .get(`/api/v1/workspaces/${world.workspaceId}/checks`)
        .set(authHeaders(world.viewer));
      expect(res.status).toBe(404);
    });
  });

  describe("other products' roles (R-38)", () => {
    it("editing someone's Check Printing roles leaves their Clock In/Out role alone", async () => {
      await giveClockRole(world, world.approver1);

      const res = await membersApi(world, world.admin).update(await memberIdOf(world, world.approver1), [
        ROLES.APPROVER,
        ROLES.VIEWER,
      ]);

      expect(res.status).toBe(200);
      expect(await rolesOf(world, world.approver1)).toEqual([ROLES.APPROVER, ROLES.VIEWER, "clock-manager"].sort());
    });

    it("removing someone from Check Printing keeps them in the workspace for their other product", async () => {
      await giveClockRole(world, world.editor);

      const res = await membersApi(world, world.admin).remove(await memberIdOf(world, world.editor));

      expect(res.status).toBe(204);
      expect(await rolesOf(world, world.editor)).toEqual(["clock-manager"]);
      expect(await isActiveMember(world, world.editor)).toBe(true);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_REMOVED" } });
      expect(audit.detailsJson).toMatchObject({ roleSlugs: [ROLES.EDITOR], leftWorkspace: false });
    });

    it("someone in the workspace only through another product can be given Check Printing roles", async () => {
      await giveClockRole(world, world.editor);
      await prisma.workspaceMemberRole.deleteMany({
        where: { workspaceMember: { userId: world.editor.id }, role: { slug: ROLES.EDITOR } },
      });

      const res = await membersApi(world, world.admin).add(world.editor, [ROLES.VIEWER]);

      expect(res.status).toBe(201);
      expect(await rolesOf(world, world.editor)).toEqual([ROLES.VIEWER, "clock-manager"].sort());
    });

    it("someone who already has Check Printing roles is still refused as a duplicate", async () => {
      const res = await membersApi(world, world.admin).add(world.editor, [ROLES.VIEWER]);

      expect(res.status).toBe(409);
      expect(await rolesOf(world, world.editor)).toEqual([ROLES.EDITOR]);
    });
  });

  describe("role lists", () => {
    it("the same role listed twice is treated as one", async () => {
      const res = await membersApi(world, world.admin).update(await memberIdOf(world, world.approver1), [
        ROLES.VIEWER,
        ROLES.VIEWER,
      ]);

      expect(res.status).toBe(200);
      expect(await rolesOf(world, world.approver1)).toEqual([ROLES.VIEWER]);
    });

    it("an unknown role is named in the error", async () => {
      const res = await membersApi(world, world.admin).update(await memberIdOf(world, world.approver1), ["check-boss"]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/check-boss/);
    });

    it("the audit log records the roles before and after", async () => {
      await membersApi(world, world.admin).update(await memberIdOf(world, world.approver1), [ROLES.PRINTER]);

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_UPDATED" } });
      expect(audit.detailsJson).toMatchObject({ previousRoleSlugs: [ROLES.APPROVER], roleSlugs: [ROLES.PRINTER] });
    });
  });

  describe("the last admin", () => {
    it("cannot be removed", async () => {
      await giveCheckRole(world, world.editor, ROLES.ADMIN);
      // The editor (now also an admin) tries to remove the original admin while the editor
      // is an admin too; then removes their own admin role, leaving one admin, and tries again.
      await membersApi(world, world.admin).update(await memberIdOf(world, world.editor), [ROLES.EDITOR]);

      const res = await membersApi(world, world.admin).remove(await memberIdOf(world, world.admin));

      expect(res.status).toBe(400);
      expect(await activeAdminCount(world)).toBe(1);
    });

    it("cannot be demoted", async () => {
      const res = await membersApi(world, world.admin).update(await memberIdOf(world, world.admin), [ROLES.EDITOR]);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/last Admin/);
      expect(await activeAdminCount(world)).toBe(1);
    });

    it("you cannot remove yourself", async () => {
      await giveCheckRole(world, world.editor, ROLES.ADMIN);

      const res = await membersApi(world, world.admin).remove(await memberIdOf(world, world.admin));

      expect(res.status).toBe(400);
      expect(await isActiveMember(world, world.admin)).toBe(true);
    });

    // Called on the service directly, not over HTTP: HTTP middleware spaces requests apart and
    // can hide a race (learned in R-01). Both calls start together, so on the old "count, then
    // change" code both see two admins and both go through.
    describe("two admins acting against each other at the same moment (R-21)", () => {
      let service: WorkspaceService;
      let productId: string;
      let admin2: TestUser;

      beforeEach(async () => {
        service = new WorkspaceService(new WorkspaceRepository(), new AuditService(), new PasswordService());
        productId = (await prisma.product.findUniqueOrThrow({ where: { slug: PRODUCT_SLUG } })).id;
        admin2 = world.approver2;
        await giveCheckRole(world, admin2, ROLES.ADMIN);
      });

      const ctx = (user: TestUser) => ({ userId: user.id, tenantId: world.tenantId });

      it("demoting each other leaves exactly one admin", async () => {
        const results = await Promise.allSettled([
          service.updateMember(world.workspaceId, world.tenantId, await memberIdOf(world, admin2),
            { roleSlugs: [ROLES.APPROVER] }, productId, ctx(world.admin)),
          service.updateMember(world.workspaceId, world.tenantId, await memberIdOf(world, world.admin),
            { roleSlugs: [ROLES.VIEWER] }, productId, ctx(admin2)),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await activeAdminCount(world)).toBe(1);
      });

      it("removing each other leaves exactly one admin", async () => {
        const results = await Promise.allSettled([
          service.removeMember(world.workspaceId, world.tenantId, await memberIdOf(world, admin2), productId, ctx(world.admin)),
          service.removeMember(world.workspaceId, world.tenantId, await memberIdOf(world, world.admin), productId, ctx(admin2)),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await activeAdminCount(world)).toBe(1);
      });
    });
  });

  describe("permissions", () => {
    it("only member managers can change members", async () => {
      const api = membersApi(world, world.editor);
      const viewerMember = await memberIdOf(world, world.viewer);

      expect((await api.update(viewerMember, [ROLES.ADMIN])).status).toBe(403);
      expect((await api.remove(viewerMember)).status).toBe(403);
      expect((await api.add(world.viewer, [ROLES.VIEWER])).status).toBe(403);
      expect(await rolesOf(world, world.viewer)).toEqual([ROLES.VIEWER]);
    });

    it("only members with member:view can list members", async () => {
      expect((await membersApi(world, world.viewer).list()).status).toBe(403);
      const res = await membersApi(world, world.admin).list();
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(6);
    });
  });
});
