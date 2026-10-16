import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { ROLES } from "../../src/shared/constants/rbac.js";

// R-37: the platform hosts several products in one workspace. Check Printing must only count
// Check Printing roles: a role from another product (here Clock In/Out) must neither grant a
// Check Printing permission (permission names can repeat across products) nor let someone
// who only uses the other product into Check Printing at all.

interface Clock {
  admin: string; // role id: manages Clock members, and its permission names collide with ours
  employee: string; // role id: punches time
}

// Clock In/Out as it will exist: its own product, permissions and roles.
async function createClockProduct(): Promise<Clock> {
  const product = await prisma.product.create({ data: { slug: "clock-in-out", name: "Clock In/Out" } });
  const permission = async (action: string) =>
    (await prisma.permission.create({ data: { productId: product.id, action } })).id;
  const role = async (slug: string, permissionIds: string[]) => {
    const created = await prisma.role.create({ data: { productId: product.id, slug, name: slug } });
    await prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: created.id, permissionId })) });
    return created.id;
  };
  // Same names as Check Printing permissions, meaning "in Clock".
  const memberManage = await permission("member:manage");
  const memberView = await permission("member:view");
  const workspaceManage = await permission("workspace:manage");
  const timePunch = await permission("time:punch");
  return {
    admin: await role("clock-admin", [memberManage, memberView, workspaceManage]),
    employee: await role("clock-employee", [timePunch]),
  };
}

const memberIdOf = async (world: TestWorld, user: TestUser) =>
  (await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: user.id } })).id;

async function giveRole(world: TestWorld, user: TestUser, roleId: string): Promise<void> {
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: await memberIdOf(world, user), roleId } });
}

// Someone in the workspace who only uses Clock In/Out.
async function createClockOnlyWorker(world: TestWorld, clock: Clock): Promise<TestUser> {
  const user = await prisma.user.create({
    data: { fullName: "Shift Worker", email: `worker-${world.workspaceId.slice(0, 8)}@example.test`, passwordHash: "x" },
  });
  await prisma.tenantMember.create({ data: { tenantId: world.tenantId, userId: user.id, role: "MEMBER" } });
  const member = await prisma.workspaceMember.create({ data: { workspaceId: world.workspaceId, userId: user.id } });
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: member.id, roleId: clock.employee } });
  return { id: user.id, email: user.email, tenantId: world.tenantId };
}

const checkRolesOf = async (world: TestWorld, user: TestUser) =>
  (
    await prisma.workspaceMemberRole.findMany({
      where: { workspaceMember: { workspaceId: world.workspaceId, userId: user.id }, role: { product: { slug: "check-printing" } } },
      include: { role: true },
    })
  ).map((r) => r.role.slug);

describe("product-scoped access (R-37)", () => {
  let world: TestWorld;
  let clock: Clock;
  const ws = () => `/api/v1/workspaces/${world.workspaceId}`;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
    clock = await createClockProduct();
  });

  describe("a Check Printing Viewer who is also a Clock admin", () => {
    beforeEach(async () => {
      await giveRole(world, world.viewer, clock.admin);
    });

    it("cannot make themselves a Check Printing admin", async () => {
      const res = await request(getApp())
        .put(`${ws()}/members/${await memberIdOf(world, world.viewer)}`)
        .set(authHeaders(world.viewer))
        .send({ roleSlugs: [ROLES.ADMIN] });

      expect(res.status).toBe(403);
      expect(await checkRolesOf(world, world.viewer)).toEqual([ROLES.VIEWER]);
    });

    it("cannot remove Check Printing members", async () => {
      const res = await request(getApp())
        .delete(`${ws()}/members/${await memberIdOf(world, world.editor)}`)
        .set(authHeaders(world.viewer));

      expect(res.status).toBe(403);
      expect(await checkRolesOf(world, world.editor)).toEqual([ROLES.EDITOR]);
    });

    it("cannot change the check-printing limits", async () => {
      const res = await request(getApp())
        .put(`${ws()}/check-printing-settings`)
        .set(authHeaders(world.viewer))
        .send({ maxCheckAmount: 999999.99 });

      expect(res.status).toBe(403);
    });

    it("still has their Check Printing Viewer access", async () => {
      const res = await request(getApp()).get(`${ws()}/checks`).set(authHeaders(world.viewer));
      expect(res.status).toBe(200);
    });
  });

  describe("someone in the workspace only through Clock In/Out", () => {
    let worker: TestUser;
    let checkId: string;

    beforeEach(async () => {
      worker = await createClockOnlyWorker(world, clock);
      const created = await request(getApp())
        .post(`${ws()}/checks`)
        .set(authHeaders(world.editor))
        .send({ bankAccountId: world.bankAccountId, payeeName: "Hill Country Supply Co.", amount: 4800, checkDate: today() });
      checkId = created.body.data.id;
    });

    it.each([
      ["GET", "/checks"],
      ["GET", "/checks/:checkId"],
      ["GET", "/checks/:checkId/attachments"],
      ["GET", "/payees"],
      ["POST", "/payees"],
      ["GET", ""],
      ["GET", "/check-printing-settings"],
      ["GET", "/bank-accounts"],
    ])("is refused on %s <workspace>%s", async (method, path) => {
      const url = `${ws()}${path.replace(":checkId", checkId)}`;
      const req = method === "POST"
        ? request(getApp()).post(url).send({ name: "Worker's Cousin LLC" })
        : request(getApp()).get(url);

      const res = await req.set(authHeaders(worker));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Check Printing/);
    });

    it("leaves an ACCESS_DENIED entry in the audit log", async () => {
      await request(getApp()).get(`${ws()}/checks`).set(authHeaders(worker));

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCESS_DENIED", userId: worker.id } });
      expect(audit.workspaceId).toBe(world.workspaceId);
      expect(audit.detailsJson).toMatchObject({ reason: "NO_PRODUCT_ROLE", product: "check-printing" });
    });

    it("does not see the workspace in their Check Printing workspace list", async () => {
      const asWorker = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(worker));
      const asEditor = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(world.editor));

      expect(asWorker.status).toBe(200);
      expect(asWorker.body.data).toEqual([]);
      expect(asEditor.body.data.map((w: { id: string }) => w.id)).toEqual([world.workspaceId]);
    });

    it("is not listed among Check Printing members", async () => {
      const res = await request(getApp()).get(`${ws()}/members`).set(authHeaders(world.admin));

      expect(res.status).toBe(200);
      expect(res.body.data.map((m: { userId: string }) => m.userId)).not.toContain(worker.id);
      expect(res.body.data).toHaveLength(6);
    });
  });

  describe("the members list", () => {
    it("shows only Check Printing roles and permissions", async () => {
      await giveRole(world, world.viewer, clock.admin);

      const res = await request(getApp()).get(`${ws()}/members`).set(authHeaders(world.admin));
      const viewer = res.body.data.find((m: { userId: string }) => m.userId === world.viewer.id);

      expect(viewer.roles).toEqual([ROLES.VIEWER]);
      expect(viewer.permissions).not.toContain("member:manage");
    });
  });

  it("someone who is not in the workspace at all still gets 404", async () => {
    const outsider = await prisma.user.create({ data: { fullName: "Outsider", email: "outsider@example.test", passwordHash: "x" } });
    await prisma.tenantMember.create({ data: { tenantId: world.tenantId, userId: outsider.id, role: "MEMBER" } });

    const res = await request(getApp())
      .get(`${ws()}/checks`)
      .set(authHeaders({ id: outsider.id, email: outsider.email, tenantId: world.tenantId }));

    expect(res.status).toBe(404);
  });
});
