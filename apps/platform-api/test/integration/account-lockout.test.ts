import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordService } from "@smartbusiness/auth";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, VALID_PASSWORD } from "../helpers/auth-client.js";
import { outbox, tokenFrom, waitForEmail } from "../helpers/emails.js";

// Account lockout: wrong passwords are counted per account (whatever IP they come from).
// Every 5th in a row locks the account for longer (1, 5, 15, then 60 minutes); a correct
// password, a password reset, or a day without attempts starts the count again.

const EMAIL = "maria@greenacres.test";
const WRONG = "Wr0ng!Passw0rd";

const login = (password = WRONG, email = EMAIL) => new AuthClient().login(email, password);
const user = () => prisma.user.findFirstOrThrow({ where: { email: EMAIL } });

async function failTimes(n: number) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(await login());
  return results;
}

// The lock has run out (as if the minutes had passed).
const expireLock = () => prisma.user.updateMany({ where: { email: EMAIL }, data: { lockedUntil: new Date(Date.now() - 1000) } });

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  outbox.clear();
  await new AuthClient().register();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("account lockout", () => {
  it("the 5th wrong password in a row locks the account for 1 minute", async () => {
    const results = await failTimes(5);

    expect(results.slice(0, 4).map((r) => [r.status, r.body.error.code])).toEqual(Array(4).fill([401, "UNAUTHORIZED"]));
    const locked = results[4]!;
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    expect(locked.body.error.message).toBe(
      "Too many wrong passwords. This account is locked for 1 minute. You can reset your password to unlock it now.",
    );
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(50);
    expect(Number(locked.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(Date.parse(locked.body.error.lockedUntil)).toBeGreaterThan(Date.now());

    const audit = await prisma.auditLog.findMany({ where: { action: "ACCOUNT_LOCKED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.detailsJson).toMatchObject({ failedAttempts: 5, lockedForMinutes: 1 });
    const failed = await prisma.auditLog.findMany({ where: { action: "LOGIN_FAILED" }, orderBy: { createdAt: "asc" } });
    expect(failed.map((f) => (f.detailsJson as { attempt: number }).attempt)).toEqual([1, 2, 3, 4, 5]);
  });

  it("while locked, even the right password is refused, and passwords aren't checked at all", async () => {
    await failTimes(5);
    const verify = vi.spyOn(PasswordService.prototype, "verify");
    const auditBefore = await prisma.auditLog.count();

    const right = await login(VALID_PASSWORD);
    await failTimes(3);

    expect(right.status).toBe(429);
    expect(right.body.error.code).toBe("ACCOUNT_LOCKED");
    expect(verify).not.toHaveBeenCalled();
    // Refusals while locked are not audited one by one: no flooding the audit log.
    expect(await prisma.auditLog.count()).toBe(auditBefore);
    expect((await user()).failedLoginCount).toBe(5);
  });

  it("when the lock runs out, the right password signs in and the count starts again", async () => {
    await failTimes(5);
    await expireLock();

    const res = await login(VALID_PASSWORD);

    expect(res.status).toBe(200);
    expect(await user()).toMatchObject({ failedLoginCount: 0, lockedUntil: null, lastFailedLoginAt: null });
  });

  it("each lock is longer: 1, 5, 15, then 60 minutes", async () => {
    const minutes: string[] = [];
    for (let round = 0; round < 5; round++) {
      const results = await failTimes(5);
      minutes.push(results[4]!.body.error.message.match(/locked for (\d+ minutes?)/)[1]);
      await expireLock();
    }

    expect(minutes).toEqual(["1 minute", "5 minutes", "15 minutes", "60 minutes", "60 minutes"]);
    expect(await prisma.auditLog.count({ where: { action: "ACCOUNT_LOCKED" } })).toBe(5);
  });

  it("a right password before the limit starts the count again", async () => {
    await failTimes(4);
    expect((await login(VALID_PASSWORD)).status).toBe(200);

    const results = await failTimes(4);

    expect(results.every((r) => r.status === 401)).toBe(true);
    expect((await user()).lockedUntil).toBeNull();
  });

  it("wrong passwords from more than a day ago don't count", async () => {
    await failTimes(4);
    await prisma.user.updateMany({ where: { email: EMAIL }, data: { lastFailedLoginAt: new Date(Date.now() - 25 * 3600_000) } });

    const res = await login();

    expect(res.status).toBe(401);
    expect((await user()).failedLoginCount).toBe(1);
  });

  it("a burst of simultaneous guesses gets only 5 password checks", async () => {
    const verify = vi.spyOn(PasswordService.prototype, "verify");

    const results = await Promise.all(Array.from({ length: 20 }, () => login()));

    expect(verify).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r.status === 401)).toHaveLength(4);
    expect(results.filter((r) => r.status === 429)).toHaveLength(16);
    expect((await user()).failedLoginCount).toBe(5);
  });

  it("resetting the password unlocks the account at once", async () => {
    await failTimes(5);
    await new AuthClient().post("/api/v1/auth/forgot-password", { email: EMAIL });
    const token = tokenFrom(await waitForEmail(EMAIL, "password-reset"), "/reset-password");
    const NEW = "N3w!Passw0rd";

    expect((await new AuthClient().post("/api/v1/auth/reset-password", { token, password: NEW })).status).toBe(200);

    expect((await login(NEW)).status).toBe(200);
  });

  it("an unknown email is never 'locked': it always gets the generic answer", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => login(WRONG, "nobody@nowhere.test")));

    expect(results.map((r) => r.status)).toEqual(Array(8).fill(401));
    expect(new Set(results.map((r) => r.body.error.message))).toEqual(new Set(["Invalid email or password."]));
  });
});
