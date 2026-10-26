import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, VALID_PASSWORD } from "../helpers/auth-client.js";
import { codeAt, stepAt } from "../../src/modules/mfa/totp.js";

// Two-factor sign-in, platform side: setup with a QR secret, confirming with a code,
// verifying a session (app code or backup code), replay and guessing limits, new backup
// codes, and turning it off. Sign-in itself is unchanged (Clock-In never asks for a code).

const EMAIL = "maria@greenacres.test";
const MFA = "/api/v1/auth/mfa";

// Each code belongs to a 30-second step and works once, so the clock moves on before
// every code, the way a person waits for the next one in their app.
function nextCode(secret: string): string {
  vi.setSystemTime(Date.now() + 30_000);
  return codeAt(secret, stepAt(Date.now()));
}

const amr = (client: AuthClient): string[] =>
  JSON.parse(Buffer.from(client.accessToken!.split(".")[1]!, "base64url").toString()).amr;

async function signedIn(): Promise<AuthClient> {
  const client = new AuthClient();
  expect((await client.login()).status).toBe(200);
  return client;
}

// Turned on for Maria; returns her secret, backup codes and the session that set it up.
async function enable(): Promise<{ secret: string; backupCodes: string[]; client: AuthClient }> {
  const client = await signedIn();
  const { secret } = (await client.post(`${MFA}/setup`)).body.data;
  const res = await client.post(`${MFA}/setup/confirm`, { code: nextCode(secret) });
  expect(res.status).toBe(200);
  return { secret, backupCodes: res.body.data.backupCodes, client };
}

const user = () => prisma.user.findFirstOrThrow({ where: { email: EMAIL } });
const audits = (action: string) => prisma.auditLog.count({ where: { action } });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date());
  await resetDatabase();
  await seedProducts();
  await new AuthClient().register();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sign-in is unchanged", () => {
  it("a password alone still signs in; the session is marked as password-only", async () => {
    const client = await signedIn();
    expect(amr(client)).toEqual(["pwd"]);
    expect((await client.get(`${MFA}`)).body.data).toMatchObject({ enabled: false, verifiedThisSession: false });
  });
});

describe("setup", () => {
  it("gives a secret once, as an authenticator link; nothing is on until a code proves it", async () => {
    const client = await signedIn();

    const res = await client.post(`${MFA}/setup`);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const { secret, otpauthUrl } = res.body.data;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl).toBe(`otpauth://totp/SmartBusiness%20Checks%3A${encodeURIComponent(EMAIL)}?secret=${secret}&issuer=SmartBusiness+Checks&algorithm=SHA1&digits=6&period=30`);
    const row = await user();
    expect(row.mfaEnabledAt).toBeNull();
    // Stored encrypted: the secret itself appears nowhere in the row.
    expect(row.mfaPendingSecretEncrypted).toMatch(/^v1\./);
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it("a wrong code doesn't turn it on; the right one does, gives 10 backup codes and verifies this session", async () => {
    const client = await signedIn();
    const { secret } = (await client.post(`${MFA}/setup`)).body.data;

    const wrong = await client.post(`${MFA}/setup/confirm`, { code: "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details.code[0]).toMatch(/isn't right/);
    expect((await user()).mfaEnabledAt).toBeNull();

    const res = await client.post(`${MFA}/setup/confirm`, { code: nextCode(secret) });

    expect(res.status).toBe(200);
    const codes: string[] = res.body.data.backupCodes;
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(codes).size).toBe(10);
    expect(amr(client)).toEqual(["pwd", "otp"]);
    const row = await user();
    expect(row.mfaEnabledAt).not.toBeNull();
    expect(row.mfaPendingSecretEncrypted).toBeNull();
    // Backup codes are stored only as keyed fingerprints.
    const stored = await prisma.mfaBackupCode.findMany({ where: { userId: row.id } });
    expect(stored).toHaveLength(10);
    for (const c of codes) expect(JSON.stringify(stored)).not.toContain(c.replace("-", ""));
    expect(await audits("MFA_ENABLED")).toBe(1);
  });

  it("coming back to an unfinished setup shows the same QR code (one entry in the app, not one per scan)", async () => {
    const client = await signedIn();
    const first = (await client.post(`${MFA}/setup`)).body.data;
    vi.setSystemTime(Date.now() + 10 * 60_000);

    const again = (await client.post(`${MFA}/setup`)).body.data;

    expect(again.secret).toBe(first.secret);
    expect(again.otpauthUrl).toBe(first.otpauthUrl);
    // The code from the entry scanned the first time works.
    expect((await client.post(`${MFA}/setup/confirm`, { code: nextCode(first.secret) })).status).toBe(200);
  });

  it("an unfinished setup older than 15 minutes gets a fresh secret", async () => {
    const client = await signedIn();
    const first = (await client.post(`${MFA}/setup`)).body.data;
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await client.refresh();

    const again = (await client.post(`${MFA}/setup`)).body.data;

    expect(again.secret).not.toBe(first.secret);
  });

  it("a setup left unconfirmed for over 15 minutes must start again", async () => {
    const client = await signedIn();
    const { secret } = (await client.post(`${MFA}/setup`)).body.data;
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await client.refresh();

    const res = await client.post(`${MFA}/setup/confirm`, { code: nextCode(secret) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MFA_SETUP_EXPIRED");
  });

  it("can't be started again while it's on", async () => {
    const { client } = await enable();
    expect((await client.post(`${MFA}/setup`)).status).toBe(409);
  });
});

describe("verifying a session", () => {
  it("a new sign-in is password-only until a code is entered; the code marks this session, and refresh keeps it", async () => {
    const { secret } = await enable();
    const client = await signedIn();
    expect(amr(client)).toEqual(["pwd"]);

    const res = await client.post(`${MFA}/verify`, { code: nextCode(secret) });

    expect(res.status).toBe(200);
    expect(amr(client)).toEqual(["pwd", "otp"]);
    expect((await client.get(MFA)).body.data).toMatchObject({ enabled: true, verifiedThisSession: true, backupCodesRemaining: 10 });
    await client.refresh();
    expect(amr(client)).toEqual(["pwd", "otp"]);
    // Another sign-in is a new session: asked again.
    expect(amr(await signedIn())).toEqual(["pwd"]);
  });

  it("refreshing a session that never entered a code doesn't make it verified", async () => {
    await enable();
    const client = await signedIn();

    expect((await client.refresh()).status).toBe(200);

    expect(amr(client)).toEqual(["pwd"]);
  });

  it("a code works once: the same code again is refused (replay)", async () => {
    const { secret } = await enable();
    const code = nextCode(secret);
    const first = await signedIn();
    const second = await signedIn();

    expect((await first.post(`${MFA}/verify`, { code })).status).toBe(200);
    const replay = await second.post(`${MFA}/verify`, { code });

    expect(replay.status).toBe(400);
    expect(amr(second)).toEqual(["pwd"]);
  });

  it("a backup code works once, typed in any case with or without the dash", async () => {
    const { backupCodes } = await enable();
    const client = await signedIn();
    const typed = backupCodes[3]!.toLowerCase().replace("-", " ");

    const res = await client.post(`${MFA}/verify`, { code: typed });

    expect(res.status).toBe(200);
    expect(res.body.data.backupCodesRemaining).toBe(9);
    expect(amr(client)).toEqual(["pwd", "otp"]);
    expect((await (await signedIn()).post(`${MFA}/verify`, { code: backupCodes[3]! })).status).toBe(400);
    expect(await audits("MFA_BACKUP_CODE_USED")).toBe(1);
  });

  it("the 5th wrong code locks code entry; while locked even the right code is refused", async () => {
    const { secret } = await enable();
    const client = await signedIn();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await client.post(`${MFA}/verify`, { code: "111111" }));

    expect(results.slice(0, 4).every((r) => r.status === 400)).toBe(true);
    expect(results[4]!.status).toBe(429);
    expect(results[4]!.body.error.code).toBe("MFA_LOCKED");
    expect(Number(results[4]!.headers["retry-after"])).toBeGreaterThan(0);

    const right = await client.post(`${MFA}/verify`, { code: nextCode(secret) });
    expect(right.status).toBe(429);
    expect(amr(client)).toEqual(["pwd"]);
    expect(await audits("MFA_FAILED")).toBe(5);
    expect(await audits("MFA_LOCKED")).toBe(1);
    // Wrong codes don't count against the password (separate counters).
    expect((await user()).failedLoginCount).toBe(0);
  });

  it("without the session's refresh cookie, nothing is verified", async () => {
    const { secret } = await enable();
    const client = await signedIn();
    client.refreshToken = undefined;

    const res = await client.post(`${MFA}/verify`, { code: nextCode(secret) });

    expect(res.status).toBe(401);
  });

  it("someone who never set it up gets a clear answer", async () => {
    const client = await signedIn();
    const res = await client.post(`${MFA}/verify`, { code: "123456" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MFA_NOT_SET_UP");
  });
});

describe("backup codes and turning off", () => {
  it("new backup codes need a current code, and replace the old ones", async () => {
    const { secret, backupCodes, client } = await enable();

    expect((await client.post(`${MFA}/backup-codes`, { code: "000000" })).status).toBe(400);
    const res = await client.post(`${MFA}/backup-codes`, { code: nextCode(secret) });

    expect(res.status).toBe(200);
    const fresh: string[] = res.body.data.backupCodes;
    expect(fresh).toHaveLength(10);
    expect((await (await signedIn()).post(`${MFA}/verify`, { code: backupCodes[0]! })).status).toBe(400);
    expect((await (await signedIn()).post(`${MFA}/verify`, { code: fresh[0]! })).status).toBe(200);
  });

  it("turning off needs the password and a code; then everything is cleared", async () => {
    const { secret, client } = await enable();

    const wrongPassword = await client.post(`${MFA}/disable`, { password: "Wr0ng!Passw0rd", code: nextCode(secret) });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.error.details.password).toBeTruthy();

    const res = await client.post(`${MFA}/disable`, { password: VALID_PASSWORD, code: nextCode(secret) });

    expect(res.status).toBe(200);
    expect(amr(client)).toEqual(["pwd"]);
    const row = await user();
    expect(row).toMatchObject({ mfaEnabledAt: null, mfaSecretEncrypted: null, mfaLastUsedStep: null });
    expect(await prisma.mfaBackupCode.count()).toBe(0);
    expect(await prisma.session.count({ where: { mfaVerifiedAt: { not: null } } })).toBe(0);
    expect(await audits("MFA_DISABLED")).toBe(1);
  });
});
