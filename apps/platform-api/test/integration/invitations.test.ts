import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp, parseSetCookies } from "../helpers/auth-client.js";
import { outbox, settle, tokenFrom, waitForEmail } from "../helpers/emails.js";
import { emailQueue, waitForQueueIdle } from "../helpers/worker.js";

// ═══════════════════════════════════════════════════════════════
// Team invitations (platform-api's side): the email worker and accepting.
//
//   A product (Check Printing) gives access and queues "workspace-invitation" with IDs.
//   The worker reads everything again: no password yet → an invitation link (created then,
//   7 days, only its fingerprint stored); a password → "you now have access"; access
//   cancelled meanwhile → nothing. Accepting sets the password and signs the person in.
// ═══════════════════════════════════════════════════════════════

const INVITEE = "priya@greenacres.test";
const NEW_PASSWORD = "N3w!Passw0rdForPriya";

let admin: { id: string; tenantId: string };
let workspaceId: string;
let invitee: { id: string };

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  outbox.clear();

  const reg = await new AuthClient().register();
  admin = { id: reg.body.data.user.id, tenantId: reg.body.data.tenants[0].tenantId };
  const ws = await prisma.workspace.create({
    data: { tenantId: admin.tenantId, businessName: "Green Acres - Main Office", addressLine1: "1 Main St", city: "Austin", state: "TX", zipCode: "78701" },
  });
  workspaceId = ws.id;

  // What Check Printing does when Maria invites Priya: the account (no password), the
  // company and workspace membership, then the job.
  invitee = await prisma.user.create({ data: { email: INVITEE, fullName: "Priya Shah", passwordHash: null } });
  await prisma.tenantMember.create({ data: { tenantId: admin.tenantId, userId: invitee.id, role: "MEMBER" } });
  await prisma.workspaceMember.create({ data: { workspaceId, userId: invitee.id } });
});

async function sendInvitation(userId = invitee.id) {
  await emailQueue.add("workspace-invitation", { userId, workspaceId, invitedById: admin.id });
  await waitForQueueIdle();
}

async function invitationToken(): Promise<string> {
  await sendInvitation();
  return tokenFrom(await waitForEmail(INVITEE, "invitation"), "/accept-invitation");
}

const inspect = (token: string) => request(getApp()).post("/api/v1/auth/invitations/inspect").send({ token });
const accept = (token: string, body: Record<string, unknown> = {}) =>
  request(getApp()).post("/api/v1/auth/invitations/accept").send({ token, fullName: "Priya S. Shah", password: NEW_PASSWORD, ...body });

describe("the invitation email (job worker)", () => {
  it("someone without a password gets a 7-day link to choose one; only the link's fingerprint is stored", async () => {
    await sendInvitation();
    const email = await waitForEmail(INVITEE, "invitation");
    expect(email.subject).toBe("Maria Rodriguez invited you to Green Acres - Main Office on SmartBusiness");
    expect(email.text).toContain("Green Acres Landscaping LLC");
    expect(email.text).toContain("expires in 7 days");

    // S7: after "#", the part of a link the browser never sends to a server (or its logs).
    const token = tokenFrom(email, "/accept-invitation");
    expect(email.text).toContain(`https://app.smartbusiness.test/accept-invitation#token=${token}`);
    expect(email.text).not.toContain("?token=");
    expect(email.html).not.toContain("?token=");

    const stored = await prisma.userToken.findFirstOrThrow({ where: { userId: invitee.id, purpose: "INVITATION" } });
    expect(stored).toMatchObject({ workspaceId, tenantId: admin.tenantId, createdById: admin.id, usedAt: null, revokedAt: null });
    expect(stored.tokenHash).not.toBe(token);
    const days = (stored.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_SENT", entityId: invitee.id } })).toBe(1);
  });

  it("someone who already has a password is told they have access, with no link", async () => {
    await prisma.user.update({ where: { id: invitee.id }, data: { passwordHash: "$argon2id$existing" } });
    await sendInvitation();
    const email = await waitForEmail(INVITEE, "added-to-workspace");
    expect(email.text).toContain("https://app.smartbusiness.test/sign-in");
    expect(email.text).not.toContain("token=");
    expect(await prisma.userToken.count({ where: { userId: invitee.id } })).toBe(0);
  });

  it("sends nothing when the access was cancelled before the job ran", async () => {
    await prisma.workspaceMember.updateMany({ where: { workspaceId, userId: invitee.id }, data: { deletedAt: new Date() } });
    await sendInvitation();
    await settle();
    expect(outbox.to(INVITEE)).toEqual([]);
    expect(await prisma.userToken.count({ where: { userId: invitee.id } })).toBe(0);
  });

  it("a resend replaces the earlier link", async () => {
    const first = await invitationToken();
    outbox.clear();
    const second = await invitationToken();
    expect(second).not.toBe(first);
    expect((await inspect(first)).body.error.code).toBe("INVITATION_REPLACED");
    expect((await inspect(second)).status).toBe(200);
  });
});

describe("showing an invitation", () => {
  it("says who invited whom to what", async () => {
    const res = await inspect(await invitationToken());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      email: INVITEE,
      fullName: "Priya Shah",
      companyName: "Green Acres Landscaping LLC",
      workspaceName: "Green Acres - Main Office",
      inviterName: "Maria Rodriguez",
      accountReady: false,
    });
  });

  it.each([
    ["an unknown link", "not-a-real-token-but-long-enough-to-look-like-one-1234", "INVALID_INVITATION_LINK"],
    ["a password-reset link", "reset", "INVALID_INVITATION_LINK"],
  ])("refuses %s", async (_label, token, code) => {
    let t = token;
    if (token === "reset") {
      await new AuthClient().post("/api/v1/auth/forgot-password", { email: "maria@greenacres.test" });
      await waitForQueueIdle();
      t = tokenFrom(await waitForEmail("maria@greenacres.test", "password-reset"), "/reset-password");
    }
    const res = await inspect(t);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
  });

  it("an expired link explains what to do", async () => {
    const token = await invitationToken();
    await prisma.userToken.updateMany({ where: { userId: invitee.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await inspect(token);
    expect(res.body.error).toMatchObject({ code: "INVITATION_EXPIRED", message: expect.stringMatching(/Ask your administrator/) });
  });
});

describe("accepting an invitation", () => {
  it("sets the password, signs the person in with httpOnly cookies (no tokens in the body), and opens the workspace", async () => {
    const res = await accept(await invitationToken());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ user: { email: INVITEE, fullName: "Priya S. Shah" }, tenantId: admin.tenantId, workspaceId });
    expect(res.body.data.tokens).toBeUndefined();

    const cookies = parseSetCookies(res);
    expect(cookies.access_token!.attributes.httponly).toBe(true);
    expect(cookies.refresh_token!.attributes.httponly).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(cookies.access_token!.value);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_ACCEPTED", userId: invitee.id } })).toBe(1);

    // From now on they sign in like everyone else.
    expect((await new AuthClient().login(INVITEE, NEW_PASSWORD)).status).toBe(200);
  });

  it("before accepting, no password at all signs them in, with the same answer as a wrong password", async () => {
    await invitationToken();
    const res = await new AuthClient().login(INVITEE, "Anything1!");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("works once: a second accept is refused and the password stays the one chosen first", async () => {
    const token = await invitationToken();
    expect((await accept(token)).status).toBe(200);
    const again = await accept(token, { password: "An0ther!Password" });
    expect(again.body.error.code).toBe("INVITATION_USED");
    expect((await new AuthClient().login(INVITEE, NEW_PASSWORD)).status).toBe(200);
  });

  it("two accepts at the same moment: exactly one succeeds", async () => {
    const token = await invitationToken();
    const results = await Promise.all([accept(token), accept(token, { password: "An0ther!Password" })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("a weak password is refused and the link still works afterwards", async () => {
    const token = await invitationToken();
    expect((await accept(token, { password: "short" })).status).toBe(400);
    expect((await accept(token)).status).toBe(200);
  });

  it("is refused once the access was cancelled, and sets no password", async () => {
    const token = await invitationToken();
    await prisma.workspaceMember.updateMany({ where: { workspaceId, userId: invitee.id }, data: { deletedAt: new Date() } });
    const res = await accept(token);
    expect(res.body.error.code).toBe("INVITATION_REPLACED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).passwordHash).toBeNull();
  });

  it("is refused for a deactivated account", async () => {
    const token = await invitationToken();
    await prisma.user.update({ where: { id: invitee.id }, data: { isActive: false } });
    expect((await accept(token)).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).passwordHash).toBeNull();
  });

  it("never replaces a password chosen through another invitation", async () => {
    const token = await invitationToken();
    await prisma.user.update({ where: { id: invitee.id }, data: { passwordHash: "$argon2id$chosen-elsewhere" } });
    const res = await accept(token);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACCOUNT_ALREADY_SET_UP");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).passwordHash).toBe("$argon2id$chosen-elsewhere");
    // The link was not used up by the refused attempt.
    expect((await prisma.userToken.findFirstOrThrow({ where: { userId: invitee.id } })).usedAt).toBeNull();
  });

  it("the email and roles cannot be changed by the person accepting", async () => {
    const res = await accept(await invitationToken(), { email: "someone.else@evil.test" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(INVITEE);
    expect(await prisma.user.count({ where: { email: "someone.else@evil.test" } })).toBe(0);
  });
});

it("the invitation links are only ever sent to the invited address", async () => {
  await sendInvitation();
  await waitForEmail(INVITEE, "invitation");
  // Only invitation emails: the owner's own welcome email (from signing up) may be there too.
  expect(outbox.sent.filter((e) => e.tag === "invitation").map((e) => e.to)).toEqual([INVITEE]);
});
