import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserTokenService } from "@smartbusiness/auth";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { emailQueue } from "../../src/jobs/queues.js";
import { ROLES } from "../../src/shared/constants/rbac.js";

// ═══════════════════════════════════════════════════════════════
// Team invitations (Check Printing's side).
//
//   - Inviting gives the access at once and queues ONE email job with IDs only; platform-api's
//     worker creates the link and sends it (tested in platform-api).
//   - A new person has NO password until they accept; the answer looks the same for a new
//     person, a colleague, and someone from another company (who joins as a plain member).
//   - The list shows ACTIVE / INVITED / INVITATION_EXPIRED; Resend (once a minute) and
//     removing the member (which cancels the link).
// ═══════════════════════════════════════════════════════════════

let world: TestWorld;
const tokens = new UserTokenService();

beforeEach(async () => {
  await resetDatabase();
  await emailQueue.raw.obliterate({ force: true });
  world = await createWorld();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const membersUrl = () => `/api/v1/workspaces/${world.workspaceId}/members`;
const invite = (body: Record<string, unknown>, as: TestUser = world.admin) =>
  request(getApp())
    .post(membersUrl())
    .set(authHeaders(as))
    .send({ fullName: "Priya Shah", roleSlugs: [ROLES.EDITOR], ...body });
const list = (as: TestUser = world.admin) => request(getApp()).get(membersUrl()).set(authHeaders(as));
const resend = (memberId: string, as: TestUser = world.admin) =>
  request(getApp()).post(`${membersUrl()}/${memberId}/invitation`).set(authHeaders(as)).send({});

async function queuedJobs() {
  const jobs = await emailQueue.raw.getJobs(["waiting", "delayed", "prioritized", "active"]);
  return jobs.map((j) => ({ name: j.name, data: j.data as Record<string, unknown> }));
}

// What the email worker does when it runs: issues the invitation link for this workspace.
const issueLink = (userId: string, ttlMs = 7 * 24 * 3600_000) =>
  tokens.issue({ userId, purpose: "INVITATION", ttlMs, tenantId: world.tenantId, workspaceId: world.workspaceId, createdById: world.admin.id });

describe("inviting someone new", () => {
  it("gives the access at once, creates the person WITHOUT a password, and queues one email job with IDs only", async () => {
    const res = await invite({ email: "Priya.Shah@Example.TEST" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: "priya.shah@example.test",
      fullName: "Priya Shah",
      roles: [ROLES.EDITOR],
      status: "INVITED",
      invitationExpiresAt: null, // the worker has not sent the link yet
      invitationEmailQueued: true,
    });

    const user = await prisma.user.findFirstOrThrow({ where: { email: "priya.shah@example.test" } });
    expect(user.passwordHash).toBeNull();
    const tm = await prisma.tenantMember.findFirstOrThrow({ where: { tenantId: world.tenantId, userId: user.id } });
    expect(tm.role).toBe("MEMBER");

    expect(await queuedJobs()).toEqual([
      { name: "workspace-invitation", data: { userId: user.id, workspaceId: world.workspaceId, invitedById: world.admin.id } },
    ]);
    // No link exists yet: the worker creates it, so no secret ever sits in the queue.
    expect(await prisma.userToken.count({ where: { userId: user.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_ADDED" } });
    expect(audit.detailsJson).toMatchObject({ newUserCreated: true, joinedCompany: false, invitationEmailQueued: true });
  });

  it("never returns the password hash, in the invite answer or the member list", async () => {
    const res = await invite({ email: "priya@example.test" });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    expect(JSON.stringify((await list()).body)).not.toMatch(/passwordHash|argon2/);
  });

  it("needs the member management permission", async () => {
    const res = await invite({ email: "priya@example.test" }, world.editor);
    expect(res.status).toBe(403);
    expect(await prisma.user.count({ where: { email: "priya@example.test" } })).toBe(0);
    expect(await queuedJobs()).toEqual([]);
  });

  it("still gives the access when the email cannot be queued, and says so (the admin can resend)", async () => {
    vi.spyOn(emailQueue, "add").mockRejectedValueOnce(new Error("Redis is down"));
    const res = await invite({ email: "priya@example.test" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: "INVITED", invitationEmailQueued: false });
  });
});

describe("inviting someone who already has an account", () => {
  it("a colleague in this company gets the roles at once and is ACTIVE (they sign in as usual)", async () => {
    // The viewer is in the company and workspace, but with no Check Printing role yet.
    await prisma.workspaceMemberRole.deleteMany({ where: { workspaceMember: { userId: world.viewer.id, workspaceId: world.workspaceId } } });
    const res = await invite({ email: world.viewer.email, fullName: "Ignored Name" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: "ACTIVE", invitationExpiresAt: null, roles: [ROLES.EDITOR] });
    expect(await queuedJobs()).toEqual([
      { name: "workspace-invitation", data: { userId: world.viewer.id, workspaceId: world.workspaceId, invitedById: world.admin.id } },
    ]);
  });

  it("someone from ANOTHER company joins this one as a plain member, with the same kind of answer", async () => {
    const other = await createWorld();
    const outsider = other.editor;

    const res = await invite({ email: outsider.email });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.data).sort()).toEqual(Object.keys((await invite({ email: "brand.new@example.test" })).body.data).sort());

    const tm = await prisma.tenantMember.findFirstOrThrow({ where: { tenantId: world.tenantId, userId: outsider.id } });
    expect(tm).toMatchObject({ role: "MEMBER", deletedAt: null });
    // Their password and their other company are untouched.
    expect(await prisma.tenantMember.count({ where: { tenantId: other.tenantId, userId: outsider.id, deletedAt: null } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } })).passwordHash).not.toBeNull();
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_ADDED", entityId: res.body.data.id } })).detailsJson).toMatchObject({ joinedCompany: true });
  });

  it("someone removed from this company comes back as a plain MEMBER, never with their old OWNER role", async () => {
    const other = await createWorld();
    const former = other.admin; // OWNER of their own company
    await prisma.tenantMember.create({ data: { tenantId: world.tenantId, userId: former.id, role: "OWNER", deletedAt: new Date() } });

    expect((await invite({ email: former.email })).status).toBe(201);
    const tm = await prisma.tenantMember.findFirstOrThrow({ where: { tenantId: world.tenantId, userId: former.id } });
    expect(tm).toMatchObject({ role: "MEMBER", deletedAt: null });
  });

  it("someone who already has Check Printing roles here is still refused as a duplicate", async () => {
    const res = await invite({ email: world.printer.email });
    expect(res.status).toBe(409);
    expect(await queuedJobs()).toEqual([]);
  });
});

describe("the member list shows where each invitation stands", () => {
  it("INVITED with the expiry once the link is sent, INVITATION_EXPIRED after it, ACTIVE once set up", async () => {
    const res = await invite({ email: "priya@example.test" });
    const userId = res.body.data.userId as string;
    const statusOf = async () => (await list()).body.data.find((m: { userId: string }) => m.userId === userId);

    const { record } = await issueLink(userId);
    expect(await statusOf()).toMatchObject({ status: "INVITED", invitationExpiresAt: record.expiresAt.toISOString() });

    await prisma.userToken.update({ where: { id: record.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await statusOf()).status).toBe("INVITATION_EXPIRED");

    await prisma.user.update({ where: { id: userId }, data: { passwordHash: "$argon2id$set-by-accepting" } });
    expect(await statusOf()).toMatchObject({ status: "ACTIVE", invitationExpiresAt: null });
  });

  it("everyone created with a password (the seeded team) is ACTIVE", async () => {
    const members = (await list()).body.data as Array<{ status: string }>;
    expect(members.length).toBeGreaterThan(0);
    expect(new Set(members.map((m) => m.status))).toEqual(new Set(["ACTIVE"]));
  });
});

describe("resending an invitation", () => {
  async function invitedMember() {
    const res = await invite({ email: "priya@example.test" });
    await emailQueue.raw.obliterate({ force: true });
    return { memberId: res.body.data.id as string, userId: res.body.data.userId as string };
  }

  it("queues a new email job", async () => {
    const { memberId, userId } = await invitedMember();
    const res = await resend(memberId);
    expect(res.status).toBe(202);
    expect(res.body.data.message).toMatch(/Earlier links no longer work/);
    expect(await queuedJobs()).toEqual([
      { name: "workspace-invitation", data: { userId, workspaceId: world.workspaceId, invitedById: world.admin.id } },
    ]);
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_RESENT" } })).toBe(1);
  });

  it("at most once a minute per person", async () => {
    const { memberId, userId } = await invitedMember();
    await issueLink(userId); // just sent
    const res = await resend(memberId);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("INVITATION_RECENTLY_SENT");
    expect(await queuedJobs()).toEqual([]);
  });

  it("is refused for someone who already set up their account", async () => {
    const memberId = (await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: world.editor.id } })).id;
    expect((await resend(memberId)).status).toBe(409);
  });

  it("answers 503 when the email cannot be queued", async () => {
    const { memberId } = await invitedMember();
    vi.spyOn(emailQueue, "add").mockRejectedValueOnce(new Error("Redis is down"));
    expect((await resend(memberId)).status).toBe(503);
  });

  it("needs the member management permission, and a member of THIS workspace", async () => {
    const { memberId } = await invitedMember();
    expect((await resend(memberId, world.editor)).status).toBe(403);

    const other = await createWorld();
    const otherMember = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: other.workspaceId } });
    expect((await resend(otherMember.id)).status).toBe(404);
  });
});

describe("cancelling an invitation (removing the member)", () => {
  it("removes the access and makes this workspace's link stop working; links to other workspaces are untouched", async () => {
    const res = await invite({ email: "priya@example.test" });
    const userId = res.body.data.userId as string;
    const { record } = await issueLink(userId);

    const other = await createWorld();
    const elsewhere = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: 3600_000, tenantId: other.tenantId, workspaceId: other.workspaceId });

    const removed = await request(getApp()).delete(`${membersUrl()}/${res.body.data.id}`).set(authHeaders(world.admin));
    expect(removed.status).toBe(204);

    expect((await prisma.userToken.findUniqueOrThrow({ where: { id: record.id } })).revokedAt).not.toBeNull();
    expect((await prisma.userToken.findUniqueOrThrow({ where: { id: elsewhere.record.id } })).revokedAt).toBeNull();
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_REMOVED" } })).detailsJson).toMatchObject({ revokedInvitations: 1 });
  });
});
