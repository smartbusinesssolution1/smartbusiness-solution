import { createHash } from "crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { TokenService } from "@smartbusiness/auth";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp, parseSetCookies, VALID_PASSWORD } from "../helpers/auth-client.js";
import { TEST_JWT_SECRET } from "../setup/test-env.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
});

// ═══════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════
describe("register", () => {
  it("creates the user, their company, an owner membership and a 14-day trial", async () => {
    const res = await new AuthClient().register();

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ fullName: "Maria Rodriguez", email: "maria@greenacres.test" });
    expect(res.body.data.tenants).toEqual([
      expect.objectContaining({ tenantName: "Green Acres Landscaping LLC", role: "OWNER", status: "ACTIVE" }),
    ]);

    const sub = await prisma.productSubscription.findFirstOrThrow({ include: { product: true } });
    expect(sub.product.slug).toBe("check-printing");
    expect(sub.status).toBe("TRIALING");
    const trialDays = (sub.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(trialDays).toBeGreaterThan(13.9);
    expect(trialDays).toBeLessThan(14.1);
  });

  it("stores only an Argon2id hash of the password", async () => {
    await new AuthClient().register();
    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(VALID_PASSWORD);
  });

  it("signs the new user in with secure cookies and never returns tokens in the body", async () => {
    const res = await new AuthClient().register();
    const cookies = parseSetCookies(res);

    for (const name of ["access_token", "refresh_token"]) {
      expect(cookies[name]!.attributes.httponly, `${name} HttpOnly`).toBe(true);
      expect(cookies[name]!.attributes.secure, `${name} Secure`).toBe(true);
      expect(cookies[name]!.attributes.samesite).toBe("Lax");
    }
    // The refresh token is only ever sent to the auth endpoints.
    expect(cookies.access_token!.attributes.path).toBe("/api");
    expect(cookies.refresh_token!.attributes.path).toBe("/api/v1/auth");

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(cookies.access_token!.value);
    expect(body).not.toContain(cookies.refresh_token!.value);
    expect(body).not.toContain("passwordHash");
  });

  // Every frontend (Check Printing, Clock-In) gets its session only as httpOnly cookies.
  it("never returns tokens in the body of a sign-in or a refresh either", async () => {
    const client = new AuthClient();
    await client.register();
    for (const res of [await client.login(), await client.refresh()]) {
      expect(res.status).toBe(200);
      const cookies = parseSetCookies(res);
      const body = JSON.stringify(res.body);
      expect(res.body.data.tokens).toBeUndefined();
      expect(body).not.toContain(cookies.access_token!.value);
      expect(body).not.toContain(cookies.refresh_token!.value);
    }
  });

  it("normalises the email to lower case", async () => {
    const res = await new AuthClient().register({ email: "  Maria@GreenAcres.TEST " });
    expect(res.body.data.user.email).toBe("maria@greenacres.test");
  });

  it("records the sign-up in the audit log", async () => {
    await new AuthClient().register();
    expect(await prisma.auditLog.count({ where: { action: "USER_REGISTERED" } })).toBe(1);
  });

  // B1
  it("answers 409 when the email is already registered", async () => {
    await new AuthClient().register();
    const res = await new AuthClient().register({ companyName: "Another Co" });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: "CONFLICT", message: "An account with this email already exists." });
  });

  // B2
  it("creates exactly one account when the same email signs up twice at once", async () => {
    const results = await Promise.all([new AuthClient().register(), new AuthClient().register()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.tenant.count()).toBe(1);
  });

  // B6
  it.each([
    ["a short password", { password: "Ab1!" }, "password", /at least 8 characters/],
    ["a password without a number", { password: "NoNumbers!!" }, "password", /at least one number/],
    ["an invalid email", { email: "not-an-email" }, "email", /Invalid email format/],
    ["a missing company name", { companyName: "" }, "companyName", /Company name is required/],
  ])("answers 400 with field details for %s", async (_label, overrides, field, message) => {
    const res = await new AuthClient().register(overrides);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[field][0]).toMatch(message);
    expect(await prisma.user.count()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
describe("login", () => {
  beforeEach(async () => {
    await new AuthClient().register();
  });

  it("signs in with the right password and records it", async () => {
    const client = new AuthClient();
    const res = await client.login();

    expect(res.status).toBe(200);
    expect(client.accessToken).toBeDefined();
    expect(client.refreshToken).toBeDefined();
    const user = await prisma.user.findFirstOrThrow();
    expect(user.lastLoginAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "USER_LOGIN" } })).toBe(1);
  });

  it("accepts the email in any letter case", async () => {
    expect((await new AuthClient().login("MARIA@greenacres.TEST")).status).toBe(200);
  });

  it("refuses a wrong password with a generic message and records the failure", async () => {
    const res = await new AuthClient().login(undefined, "Wr0ng!Password");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
    expect(await prisma.auditLog.count({ where: { action: "LOGIN_FAILED" } })).toBe(1);
  });

  it("gives an unknown email exactly the same answer as a wrong password", async () => {
    const unknown = await new AuthClient().login("nobody@greenacres.test", VALID_PASSWORD);
    const wrong = await new AuthClient().login(undefined, "Wr0ng!Password");

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.error).toEqual(wrong.body.error);
  });

  // B3
  describe("does not reveal account status to someone without the password", () => {
    it("deactivated account + wrong password → the generic answer", async () => {
      await prisma.user.updateMany({ data: { isActive: false } });
      const res = await new AuthClient().login(undefined, "Wr0ng!Password");
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Invalid email or password.");
    });

    it("deactivated account + right password → told it is deactivated", async () => {
      await prisma.user.updateMany({ data: { isActive: false } });
      const res = await new AuthClient().login();
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Account has been deactivated.");
    });

    it("suspended company + wrong password → the generic answer", async () => {
      await prisma.tenant.updateMany({ data: { status: "SUSPENDED" } });
      const res = await new AuthClient().login(undefined, "Wr0ng!Password");
      expect(res.body.error.message).toBe("Invalid email or password.");
    });

    it("suspended company + right password → told there is no active organization", async () => {
      await prisma.tenant.updateMany({ data: { status: "SUSPENDED" } });
      const res = await new AuthClient().login();
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("No active organization found for this account.");
    });
  });

  it("refuses an invited user who has not set a password yet, with the generic answer", async () => {
    const tenant = await prisma.tenant.findFirstOrThrow();
    const invited = await prisma.user.create({
      data: { fullName: "Jennifer Chen", email: "jennifer@greenacres.test", passwordHash: null },
    });
    await prisma.tenantMember.create({ data: { tenantId: tenant.id, userId: invited.id, role: "MEMBER" } });

    const res = await new AuthClient().login("jennifer@greenacres.test", VALID_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("keeps at most 5 sessions: a 6th sign-in ends the oldest", async () => {
    const devices = Array.from({ length: 6 }, () => new AuthClient());
    for (const d of devices) {
      expect((await d.login()).status).toBe(200);
    }
    // The registration session plus 6 logins: only the 5 newest remain usable.
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(5);
    expect((await devices[0]!.refresh()).status).toBe(401);
    expect((await devices[5]!.refresh()).status).toBe(200);
  });

  // B5
  it("answers 400 to a malformed JSON body", async () => {
    const res = await request(getApp())
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "maria@greenacres.test",');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});

// ═══════════════════════════════════════════════════════════════
// ACCESS TOKEN (the 15-minute key card)
// ═══════════════════════════════════════════════════════════════
describe("access token", () => {
  it("lets /me identify the user and their companies", async () => {
    const client = new AuthClient();
    await client.register();

    const res = await client.me();
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("maria@greenacres.test");
    expect(res.body.data.tenants).toHaveLength(1);
  });

  it("carries only the user id and email, never the tenant", async () => {
    const client = new AuthClient();
    await client.register();
    const payload = JSON.parse(Buffer.from(client.accessToken!.split(".")[1]!, "base64url").toString());

    expect(Object.keys(payload).sort()).toEqual(["email", "exp", "iat", "userId"]);
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("is refused when missing", async () => {
    expect((await new AuthClient().me()).status).toBe(401);
  });

  // Tokens are never handed to JavaScript, so the cookie is the only way to present one. A valid
  // token sent any other way (copied out of a browser, say) does not sign anyone in.
  it("is refused when sent as an Authorization: Bearer header instead of the cookie", async () => {
    const client = new AuthClient();
    await client.register();
    const res = await request(getApp()).get("/api/v1/auth/me").set("Authorization", `Bearer ${client.accessToken!}`);
    expect(res.status).toBe(401);
  });

  it("is refused when signed with another secret", async () => {
    const forged = new TokenService("a-completely-different-secret-0123456789", "15m")
      .generateAccessToken({ userId: "someone", email: "x@y.test" });
    const res = await request(getApp()).get("/api/v1/auth/me").set("Cookie", `access_token=${forged}`);
    expect(res.status).toBe(401);
  });

  it("is refused once expired", async () => {
    const client = new AuthClient();
    await client.register();
    const user = await prisma.user.findFirstOrThrow();
    const expired = new TokenService(TEST_JWT_SECRET, "1ms").generateAccessToken({ userId: user.id, email: user.email });
    await new Promise((r) => setTimeout(r, 1100));

    const res = await request(getApp()).get("/api/v1/auth/me").set("Cookie", `access_token=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token expired. Please login again.");
  });
});

// ═══════════════════════════════════════════════════════════════
// REFRESH (swapping the reservation slip)
// ═══════════════════════════════════════════════════════════════
describe("refresh", () => {
  let client: AuthClient;

  beforeEach(async () => {
    client = new AuthClient();
    await client.register();
  });

  it("issues a new access token and a new refresh token", async () => {
    const oldRefresh = client.refreshToken;
    const res = await client.refresh();

    expect(res.status).toBe(200);
    expect(client.refreshToken).toBeDefined();
    expect(client.refreshToken).not.toBe(oldRefresh);
    expect((await client.me()).status).toBe(200);
  });

  it("rotates: the old refresh token stops working", async () => {
    const stolenCopy = client.refreshToken!;
    await client.refresh();

    const thief = new AuthClient();
    thief.refreshToken = stolenCopy;
    expect((await thief.refresh()).status).toBe(401);
    expect((await client.refresh()).status).toBe(200);
  });

  it("stores only a SHA-256 fingerprint of the refresh token", async () => {
    const session = await prisma.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(sha256(client.refreshToken!));
    expect(session.tokenHash).not.toBe(client.refreshToken);
  });

  it.each([
    ["no refresh token", undefined],
    ["an unknown refresh token", "not-a-real-token"],
  ])("is refused with %s", async (_label, token) => {
    const other = new AuthClient();
    other.refreshToken = token;
    expect((await other.refresh()).status).toBe(401);
  });

  it("is refused after the session expires", async () => {
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await client.refresh()).status).toBe(401);
  });

  it("is refused and ends the session when the account was deactivated", async () => {
    await prisma.user.updateMany({ data: { isActive: false } });

    const res = await client.refresh();
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Account has been deactivated.");
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════
describe("logout", () => {
  let client: AuthClient;

  beforeEach(async () => {
    client = new AuthClient();
    await client.register();
  });

  it("ends the session and clears both cookies", async () => {
    const refreshCopy = client.refreshToken!;
    const res = await client.logout();

    expect(res.status).toBe(200);
    expect(client.accessToken).toBeUndefined();
    expect(client.refreshToken).toBeUndefined();

    const replay = new AuthClient();
    replay.refreshToken = refreshCopy;
    expect((await replay.refresh()).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { action: "USER_LOGOUT" } })).toBe(1);
  });

  // B4
  it("still ends the session when the 15-minute access token has already expired", async () => {
    const refreshCopy = client.refreshToken!;
    client.accessToken = undefined; // the key card expired while the user was idle

    const res = await client.logout();
    expect(res.status).toBe(200);

    const replay = new AuthClient();
    replay.refreshToken = refreshCopy;
    expect((await replay.refresh()).status).toBe(401);
  });

  it("is safe to call twice, or with no session at all", async () => {
    expect((await client.logout()).status).toBe(200);
    expect((await client.logout()).status).toBe(200);
    expect((await new AuthClient().logout()).status).toBe(200);
  });

  it("only ends this device's session", async () => {
    const laptop = new AuthClient();
    await laptop.login();

    await client.logout();
    expect((await laptop.refresh()).status).toBe(200);
  });
});

describe("logout from all devices", () => {
  it("ends every session of the user, including other devices", async () => {
    const phone = new AuthClient();
    await phone.register();
    const laptop = new AuthClient();
    await laptop.login();

    const res = await phone.logoutAll();
    expect(res.status).toBe(200);
    expect((await laptop.refresh()).status).toBe(401);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "ALL_SESSIONS_REVOKED" } })).toBe(1);
  });

  it("requires a signed-in user", async () => {
    expect((await new AuthClient().logoutAll()).status).toBe(401);
  });
});
