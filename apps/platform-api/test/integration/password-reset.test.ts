import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, VALID_PASSWORD } from "../helpers/auth-client.js";
import { outbox, settle, tokenFrom, waitForEmail } from "../helpers/emails.js";

// A4.3: forgot password and reset password.

const EMAIL = "maria@greenacres.test";
const NEW_PASSWORD = "N3w!Passw0rd";
const GENERIC = "If an account exists for that email, we've sent a link to reset the password.";

const forgot = (email: string) => new AuthClient().post("/api/v1/auth/forgot-password", { email });
const reset = (token: string, password = NEW_PASSWORD) =>
  new AuthClient().post("/api/v1/auth/reset-password", { token, password });

async function requestResetToken(email = EMAIL): Promise<string> {
  await forgot(email);
  return tokenFrom(await waitForEmail(email, "password-reset"), "/reset-password");
}

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  outbox.clear();
  await new AuthClient().register();
  outbox.clear();
});

describe("forgot password", () => {
  it("emails a one-hour reset link built from APP_URL", async () => {
    const res = await forgot(EMAIL);
    expect(res.status).toBe(202);
    expect(res.body.data.message).toBe(GENERIC);

    const email = await waitForEmail(EMAIL, "password-reset");
    expect(email.text).toMatch(/^Hi Maria Rodriguez,/);
    expect(email.text).toContain("https://app.smartbusiness.test/reset-password#token=");
    expect(email.text).toContain("expires in 60 minutes");
    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_RESET_REQUESTED" } })).toBe(1);
  });

  // S7: the browser sends everything before "#" to the web server (and its logs, a CDN's
  // logs, Referer headers); the part after "#" never leaves the browser.
  it("puts the token only in the part of the link that never leaves the browser", async () => {
    await forgot(EMAIL);
    const email = await waitForEmail(EMAIL, "password-reset");
    const token = tokenFrom(email, "/reset-password");
    const link = new URL(email.text.match(/https:\/\/\S+/)![0]);

    expect(link.hash).toBe(`#token=${token}`);
    expect(`${link.origin}${link.pathname}${link.search}`).not.toContain(token);
    expect(email.html).not.toContain("?token=");
  });

  it("gives an unknown email exactly the same answer, and sends nothing", async () => {
    const known = await forgot(EMAIL);
    const unknown = await forgot("nobody@greenacres.test");

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    await settle();
    expect(outbox.to("nobody@greenacres.test")).toEqual([]);
  });

  it("never builds the link from the request's Host header", async () => {
    await new AuthClient().post("/api/v1/auth/forgot-password", { email: EMAIL });
    const email = await waitForEmail(EMAIL, "password-reset");
    expect(email.text).not.toContain("127.0.0.1");
    expect(email.html).not.toContain("127.0.0.1");
  });

  it("accepts the email in any letter case, with spaces", async () => {
    expect((await forgot("  MARIA@GreenAcres.TEST ")).status).toBe(202);
    await waitForEmail(EMAIL, "password-reset");
  });

  it("sends nothing to a deactivated account, but answers the same", async () => {
    await prisma.user.updateMany({ data: { isActive: false } });
    const res = await forgot(EMAIL);
    expect(res.body.data.message).toBe(GENERIC);
    await settle();
    expect(outbox.to(EMAIL)).toEqual([]);
  });

  it("sends at most one email per minute to the same account", async () => {
    await Promise.all(Array.from({ length: 5 }, () => forgot(EMAIL)));
    await waitForEmail(EMAIL, "password-reset");
    await settle();
    expect(outbox.to(EMAIL, "password-reset")).toHaveLength(1);
  });

  it("after the cooldown sends a new link and the older one stops working", async () => {
    const first = await requestResetToken();
    await prisma.userToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
    outbox.clear();
    const second = await requestResetToken();

    expect(second).not.toBe(first);
    const res = await reset(first);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_LINK_REPLACED");
    expect((await reset(second)).status).toBe(200);
  });

  it("answers 400 to a malformed email address", async () => {
    const res = await forgot("not-an-email");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("reset password", () => {
  it("changes the password: the new one works and the old one no longer does", async () => {
    const token = await requestResetToken();

    const res = await reset(token);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe("Your password has been changed. Sign in with your new password.");

    expect((await new AuthClient().login(EMAIL, NEW_PASSWORD)).status).toBe(200);
    expect((await new AuthClient().login(EMAIL, VALID_PASSWORD)).status).toBe(401);
  });

  it("signs the account out on every device", async () => {
    const laptop = new AuthClient();
    await laptop.login();
    const phone = new AuthClient();
    await phone.login();

    await reset(await requestResetToken());

    expect((await laptop.refresh()).status).toBe(401);
    expect((await phone.refresh()).status).toBe(401);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("emails the owner that the password was changed, and audits it", async () => {
    await reset(await requestResetToken());

    const notice = await waitForEmail(EMAIL, "password-changed");
    expect(notice.text).toContain("signed out on every device");
    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_RESET" } })).toBe(1);
  });

  it("works only once", async () => {
    const token = await requestResetToken();
    expect((await reset(token)).status).toBe(200);

    const again = await reset(token, "An0ther!Passw0rd");
    expect(again.status).toBe(400);
    expect(again.body.error).toEqual({
      code: "RESET_LINK_USED",
      message: "This link was already used. Request a new one if you still need to reset your password.",
    });
    expect((await new AuthClient().login(EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it("lets only one of two simultaneous resets with the same link succeed", async () => {
    const token = await requestResetToken();
    const [a, b] = await Promise.all([reset(token, "Fir5t!Password"), reset(token, "Seco2d!Password")]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const winner = a.status === 200 ? "Fir5t!Password" : "Seco2d!Password";
    expect((await new AuthClient().login(EMAIL, winner)).status).toBe(200);
  });

  it("refuses a weak new password without using up the link", async () => {
    const token = await requestResetToken();

    const weak = await reset(token, "short");
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("VALIDATION_ERROR");

    expect((await reset(token)).status).toBe(200);
  });

  it("refuses an expired link", async () => {
    const token = await requestResetToken();
    await prisma.userToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await reset(token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_LINK_EXPIRED");
    expect((await new AuthClient().login(EMAIL, VALID_PASSWORD)).status).toBe(200);
  });

  it.each(["A".repeat(43), "garbage", ""])("refuses an invalid token %#", async (token) => {
    const res = await reset(token);
    expect(res.status).toBe(400);
    expect(["INVALID_RESET_LINK", "VALIDATION_ERROR"]).toContain(res.body.error.code);
  });

  it("refuses the link if the account was deactivated after it was sent, and keeps it unused", async () => {
    const token = await requestResetToken();
    await prisma.user.updateMany({ data: { isActive: false } });

    const res = await reset(token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_RESET_LINK");
    const stored = await prisma.userToken.findFirstOrThrow();
    expect(stored.usedAt).toBeNull();
  });

  it("lets an invited user who never set a password set one, confirming their email", async () => {
    const tenant = await prisma.tenant.findFirstOrThrow();
    const invited = await prisma.user.create({
      data: { fullName: "Jennifer Chen", email: "jennifer@greenacres.test", passwordHash: null },
    });
    await prisma.tenantMember.create({ data: { tenantId: tenant.id, userId: invited.id, role: "MEMBER" } });
    await prisma.userToken.create({
      data: {
        userId: invited.id,
        purpose: "INVITATION",
        tokenHash: "f".repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const token = await requestResetToken("jennifer@greenacres.test");
    expect((await reset(token)).status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect((await new AuthClient().login("jennifer@greenacres.test", NEW_PASSWORD)).status).toBe(200);
    // Their pending invitation is no longer needed and stops working.
    const invitation = await prisma.userToken.findFirstOrThrow({ where: { purpose: "INVITATION" } });
    expect(invitation.revokedAt).not.toBeNull();
  });

  it("clears the auth cookies of the browser that reset the password", async () => {
    const token = await requestResetToken();
    const browser = new AuthClient();
    await browser.login();

    await browser.post("/api/v1/auth/reset-password", { token, password: NEW_PASSWORD });
    expect(browser.accessToken).toBeUndefined();
    expect(browser.refreshToken).toBeUndefined();
  });
});
