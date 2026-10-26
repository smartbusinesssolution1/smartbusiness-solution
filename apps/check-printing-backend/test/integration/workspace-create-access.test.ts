import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { ROLES } from "../../src/shared/constants/rbac.js";

// S1: creating a workspace makes its creator the workspace's admin (bank accounts, printing,
// members). It was open to anyone in the company with Check Printing, so a viewer could give
// themselves all of that in a workspace of their own. Only the company owner may open one.

const NEW_WORKSPACE = { businessName: "Green Acres Design LLC", addressLine1: "1 Elm St", city: "Austin", state: "TX", zipCode: "78701" };

const createWorkspace = (user: TestUser, body: Record<string, unknown> = NEW_WORKSPACE) =>
  request(getApp()).post("/api/v1/workspaces").set(authHeaders(user)).send(body);

const workspaceCount = (world: TestWorld) => prisma.workspace.count({ where: { tenantId: world.tenantId } });

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

describe("who may create a workspace", () => {
  it("the company owner creates one and becomes its admin", async () => {
    const res = await createWorkspace(world.admin);

    expect(res.status).toBe(201);
    const roles = await prisma.workspaceMemberRole.findMany({
      where: { workspaceMember: { workspaceId: res.body.data.id, userId: world.admin.id } },
      include: { role: true },
    });
    expect(roles.map((r) => r.role.slug)).toEqual([ROLES.ADMIN]);
  });

  it.each(["editor", "approver1", "printer", "viewer"] as const)("the %s (a company member) is refused, and no workspace is made", async (who) => {
    const before = await workspaceCount(world);

    const res = await createWorkspace(world[who]);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/company owner/);
    expect(await workspaceCount(world)).toBe(before);
  });

  it("an admin of a workspace who is not the company owner is refused: admin of one workspace is not owner of the company", async () => {
    const adminRole = await prisma.role.findFirstOrThrow({ where: { slug: ROLES.ADMIN } });
    const member = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: world.editor.id } });
    await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: member.id, roleId: adminRole.id, assignedById: world.admin.id } });

    expect((await createWorkspace(world.editor)).status).toBe(403);
  });

  it("a company ADMIN (Clock-In's admin role) is refused too", async () => {
    await prisma.tenantMember.updateMany({ where: { tenantId: world.tenantId, userId: world.viewer.id }, data: { role: "ADMIN" } });

    expect((await createWorkspace(world.viewer)).status).toBe(403);
  });

  it("an owner who is demoted is refused on the very next request", async () => {
    await prisma.tenantMember.updateMany({ where: { tenantId: world.tenantId, userId: world.admin.id }, data: { role: "MEMBER" } });

    expect((await createWorkspace(world.admin)).status).toBe(403);
  });

  it("refuses before reading the form: a non-owner gets 403, not a list of field errors", async () => {
    const res = await createWorkspace(world.viewer, {});

    expect(res.status).toBe(403);
  });

  it("leaves an ACCESS_DENIED entry in the audit log", async () => {
    await createWorkspace(world.viewer);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCESS_DENIED", userId: world.viewer.id } });
    expect(audit.tenantId).toBe(world.tenantId);
    expect(audit.detailsJson).toMatchObject({ reason: "NOT_COMPANY_OWNER", method: "POST", url: "/api/v1/workspaces" });
  });
});
