import { createHash } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { UserTokenService } from "@smartbusiness/auth";
import { prisma, resetDatabase } from "../helpers/db.js";

// A4.2: the shared one-time token service (packages/auth) against a real database.

const HOUR = 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let userId: string;
let tenantId: string;
let workspaceA: string;
let workspaceB: string;
const tokens = new UserTokenService();

beforeEach(async () => {
  await resetDatabase();
  const tenant = await prisma.tenant.create({ data: { name: "Green Acres", billingEmail: "billing@greenacres.test" } });
  tenantId = tenant.id;
  const user = await prisma.user.create({
    data: { fullName: "Jennifer Chen", email: "jennifer@greenacres.test", passwordHash: null },
  });
  userId = user.id;
  const ws = (name: string) =>
    prisma.workspace.create({
      data: { tenantId, businessName: name, addressLine1: "1 Main St", city: "Austin", state: "TX", zipCode: "78701" },
    });
  workspaceA = (await ws("Green Acres")).id;
  workspaceB = (await ws("Green Acres East")).id;
});

describe("issue", () => {
  it("returns a 43-character URL-safe token and stores only its SHA-256 fingerprint", async () => {
    const { token, record } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(record.tokenHash).toBe(sha256(token));
    const stored = await prisma.userToken.findUniqueOrThrow({ where: { id: record.id } });
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("never issues the same token twice", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add((await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR })).token);
    }
    expect(seen.size).toBe(50);
  });

  it("sets the expiry from the requested lifetime", async () => {
    const before = Date.now();
    const { record } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    const lifetime = record.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(HOUR - 5000);
    expect(lifetime).toBeLessThanOrEqual(HOUR + 1000);
  });

  it("revokes the user's older reset link when a new one is issued", async () => {
    const first = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    const second = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    expect(await tokens.inspect(first.token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "REVOKED" });
    expect((await tokens.inspect(second.token, "PASSWORD_RESET")).ok).toBe(true);
  });

  it("keeps invitations to different workspaces independent", async () => {
    const toA = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceA });
    const toB = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceB });

    expect((await tokens.inspect(toA.token, "INVITATION")).ok).toBe(true);
    expect((await tokens.inspect(toB.token, "INVITATION")).ok).toBe(true);
  });

  it("does not let a new reset link revoke an invitation", async () => {
    const invite = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceA });
    await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    expect((await tokens.inspect(invite.token, "INVITATION")).ok).toBe(true);
  });
});

describe("inspect", () => {
  it("reports a usable token with its record", async () => {
    const { token } = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceA });
    const check = await tokens.inspect(token, "INVITATION");
    expect(check.ok && check.record.workspaceId).toBe(workspaceA);
  });

  it("does not use up the token", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    await tokens.inspect(token, "PASSWORD_RESET");
    expect((await tokens.consume(token, "PASSWORD_RESET")).ok).toBe(true);
  });

  it("reports an expired token as EXPIRED", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    const twoHoursLater = new UserTokenService(prisma, () => new Date(Date.now() + 2 * HOUR));
    expect(await twoHoursLater.inspect(token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "EXPIRED" });
  });

  it.each([
    ["an unknown token", "A".repeat(43)],
    ["a malformed token", "not-a-token"],
    ["an empty value", ""],
    ["a non-string", 12345],
  ])("reports %s as NOT_FOUND", async (_label, value) => {
    expect(await tokens.inspect(value, "PASSWORD_RESET")).toEqual({ ok: false, problem: "NOT_FOUND" });
  });
});

describe("consume", () => {
  it("works exactly once", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    const first = await tokens.consume(token, "PASSWORD_RESET");
    expect(first.ok).toBe(true);
    expect(first.ok && first.record.usedAt).toBeInstanceOf(Date);

    expect(await tokens.consume(token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "USED" });
  });

  it("lets exactly one of several simultaneous clicks succeed", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    const results = await Promise.all(Array.from({ length: 8 }, () => tokens.consume(token, "PASSWORD_RESET")));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.problem === "USED")).toHaveLength(7);
  });

  it("refuses a token for another purpose and leaves it usable for its own", async () => {
    const reset = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    expect(await tokens.consume(reset.token, "INVITATION")).toEqual({ ok: false, problem: "NOT_FOUND" });
    expect((await tokens.consume(reset.token, "PASSWORD_RESET")).ok).toBe(true);
  });

  it("refuses an expired token", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    const later = new UserTokenService(prisma, () => new Date(Date.now() + 2 * HOUR));
    expect(await later.consume(token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "EXPIRED" });
  });

  it("refuses a revoked token", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    expect(await tokens.consume(token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "REVOKED" });
  });

  it("rolls back with the surrounding transaction", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });

    await expect(
      prisma.$transaction(async (tx) => {
        expect((await tokens.consume(token, "PASSWORD_RESET", tx)).ok).toBe(true);
        throw new Error("the password update failed");
      }),
    ).rejects.toThrow("the password update failed");

    // Nothing committed: the link still works.
    expect((await tokens.consume(token, "PASSWORD_RESET")).ok).toBe(true);
  });
});

describe("revokeForUser", () => {
  it("cancels one workspace's invitation and leaves the others", async () => {
    const toA = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceA });
    const toB = await tokens.issue({ userId, purpose: "INVITATION", ttlMs: HOUR, tenantId, workspaceId: workspaceB });

    expect(await tokens.revokeForUser(userId, "INVITATION", { workspaceId: workspaceA })).toBe(1);
    expect(await tokens.inspect(toA.token, "INVITATION")).toEqual({ ok: false, problem: "REVOKED" });
    expect((await tokens.inspect(toB.token, "INVITATION")).ok).toBe(true);
  });

  it("never touches a link that was already used", async () => {
    const { token } = await tokens.issue({ userId, purpose: "PASSWORD_RESET", ttlMs: HOUR });
    await tokens.consume(token, "PASSWORD_RESET");
    expect(await tokens.revokeForUser(userId, "PASSWORD_RESET")).toBe(0);
    expect(await tokens.inspect(token, "PASSWORD_RESET")).toEqual({ ok: false, problem: "USED" });
  });
});
