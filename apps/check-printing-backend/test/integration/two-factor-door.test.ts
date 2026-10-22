import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// Check Printing's two-factor rule: anyone who is an Admin in ANY Check Printing workspace
// of the company (or who turned it on by choice) must have entered a code this session
// (amr "otp" in the access token). Sign-in itself is unchanged, so other products aren't
// affected. The company owner can reset someone's two-factor.

const PASSWORD_ONLY = { amr: ["pwd"] };

const get = (path: string, user: TestUser, options: { amr?: string[] } = {}) =>
  request(getApp()).get(`/api/v1${path}`).set(authHeaders(user, options));

async function makeAdmin(world: TestWorld, user: TestUser, workspaceId = world.workspaceId) {
  const role = await prisma.role.findFirstOrThrow({ where: { slug: "check-admin" } });
  const member =
    (await prisma.workspaceMember.findFirst({ where: { userId: user.id, workspaceId } })) ??
    (await prisma.workspaceMember.create({ data: { userId: user.id, workspaceId } }));
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: member.id, roleId: role.id } });
}

const enroll = (user: TestUser) => prisma.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });

describe("two-factor in Check Printing", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("who is asked", () => {
    it("an admin with a password-only session is asked for the code, everywhere in Check Printing", async () => {
      for (const path of ["/workspaces", `/workspaces/${world.workspaceId}`, `/workspaces/${world.workspaceId}/checks`]) {
        const res = await get(path, world.admin, PASSWORD_ONLY);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("MFA_REQUIRED");
      }
    });

    it("an admin whose session entered the code gets in", async () => {
      expect((await get(`/workspaces/${world.workspaceId}/checks`, world.admin)).status).toBe(200);
    });

    it("an admin who never set it up is sent to set it up (even with a token that says otp)", async () => {
      await prisma.user.update({ where: { id: world.admin.id }, data: { mfaEnabledAt: null } });

      const res = await get(`/workspaces/${world.workspaceId}/checks`, world.admin);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("MFA_SETUP_REQUIRED");
    });

    it("someone who isn't an Admin anywhere works with a password alone", async () => {
      for (const user of [world.editor, world.viewer, world.printer, world.approver1]) {
        expect((await get(`/workspaces/${world.workspaceId}/checks`, user, PASSWORD_ONLY)).status).toBe(200);
      }
    });

    it("an Admin in another workspace of the same company is asked here too", async () => {
      const other = await prisma.workspace.create({
        data: { tenantId: world.tenantId, businessName: "Second LLC", addressLine1: "2 Main St", city: "Austin", state: "TX", zipCode: "78701" },
      });
      await makeAdmin(world, world.editor, other.id);
      await enroll(world.editor);

      const res = await get(`/workspaces/${world.workspaceId}/checks`, world.editor, PASSWORD_ONLY);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("MFA_REQUIRED");
    });

    it("being an Admin in a different company doesn't count here", async () => {
      const elsewhere = await createWorld();
      await prisma.tenantMember.create({ data: { tenantId: elsewhere.tenantId, userId: world.editor.id, role: "MEMBER" } });
      await makeAdmin(elsewhere, world.editor, elsewhere.workspaceId);

      expect((await get(`/workspaces/${world.workspaceId}/checks`, world.editor, PASSWORD_ONLY)).status).toBe(200);
    });

    it("someone who turned it on by choice is asked too", async () => {
      await enroll(world.viewer);

      const res = await get(`/workspaces/${world.workspaceId}/checks`, world.viewer, PASSWORD_ONLY);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("MFA_REQUIRED");
    });

    it("being made an Admin takes effect at once", async () => {
      expect((await get(`/workspaces/${world.workspaceId}/checks`, world.editor, PASSWORD_ONLY)).status).toBe(200);

      await makeAdmin(world, world.editor);

      expect((await get(`/workspaces/${world.workspaceId}/checks`, world.editor, PASSWORD_ONLY)).body.error.code).toBe("MFA_SETUP_REQUIRED");
    });
  });

  describe("the company owner's reset", () => {
    const reset = (user: TestUser, memberId: string) =>
      request(getApp()).post(`/api/v1/workspaces/${world.workspaceId}/members/${memberId}/two-factor/reset`).set(authHeaders(user));
    const memberOf = async (user: TestUser) =>
      (await prisma.workspaceMember.findFirstOrThrow({ where: { userId: user.id, workspaceId: world.workspaceId } })).id;

    it("clears someone's two-factor: secret, backup codes and verified sessions; they set it up again", async () => {
      await prisma.user.update({
        where: { id: world.editor.id },
        data: { mfaEnabledAt: new Date(), mfaSecretEncrypted: "v1.x.y.z", mfaLastUsedStep: 123, mfaFailedCount: 3 },
      });
      await prisma.mfaBackupCode.create({ data: { userId: world.editor.id, codeHash: "a".repeat(64) } });
      await prisma.session.create({
        data: { userId: world.editor.id, tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + 86_400_000), mfaVerifiedAt: new Date() },
      });

      const res = await reset(world.admin, await memberOf(world.editor));

      expect(res.status).toBe(200);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: world.editor.id } })).toMatchObject({
        mfaEnabledAt: null,
        mfaSecretEncrypted: null,
        mfaLastUsedStep: null,
        mfaFailedCount: 0,
      });
      expect(await prisma.mfaBackupCode.count({ where: { userId: world.editor.id } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: world.editor.id, mfaVerifiedAt: { not: null } } })).toBe(0);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MFA_RESET_BY_OWNER" } });
      expect(audit).toMatchObject({ userId: world.admin.id, workspaceId: world.workspaceId });
      expect(audit.detailsJson).toMatchObject({ memberEmail: world.editor.email });
    });

    it("only the company owner may reset, and not for themselves", async () => {
      await enroll(world.editor);
      // A workspace Admin who isn't the company owner.
      await makeAdmin(world, world.approver1);
      await enroll(world.approver1);

      expect((await reset(world.approver1, await memberOf(world.editor))).status).toBe(403);
      expect((await reset(world.admin, await memberOf(world.admin))).status).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: world.editor.id } })).mfaEnabledAt).not.toBeNull();
    });

    it("someone without two-factor can't be reset", async () => {
      expect((await reset(world.admin, await memberOf(world.viewer))).status).toBe(409);
    });

    it("the team list says who has it on", async () => {
      const res = await request(getApp()).get(`/api/v1/workspaces/${world.workspaceId}/members`).set(authHeaders(world.admin));

      const flags = Object.fromEntries((res.body.data as Array<{ userId: string; twoFactorEnabled: boolean }>).map((m) => [m.userId, m.twoFactorEnabled]));
      expect(flags[world.admin.id]).toBe(true);
      expect(flags[world.editor.id]).toBe(false);
    });
  });
});
