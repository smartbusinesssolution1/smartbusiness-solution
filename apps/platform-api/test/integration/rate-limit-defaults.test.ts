import { afterEach, describe, expect, it, vi } from "vitest";

// Per-IP limits: strict by default in production and staging, roomier in development
// (one developer's machine sends every request), and a value set in the environment
// always wins. The config is read once at startup, so each case loads it afresh.

async function limitsFor(env: Record<string, string | undefined>) {
  // Only the values given here: not whatever the developer's own .env says.
  vi.doMock("dotenv", () => ({ default: { config: () => ({}) } }));
  vi.resetModules();
  for (const name of ["RATE_LIMIT_MAX", "AUTH_RATE_LIMIT_MAX", "REFRESH_RATE_LIMIT_MAX", "INVITATION_RATE_LIMIT_MAX", "MFA_RATE_LIMIT_MAX"]) vi.stubEnv(name, undefined);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("../../src/config/index.js")).rateLimits;
}

afterEach(() => {
  vi.doUnmock("dotenv");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rate limit defaults", () => {
  it("production keeps the strict limits", async () => {
    const limits = await limitsFor({ NODE_ENV: "production", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "email-smtp.us-east-1.amazonaws.com", SMTP_USER: "u", SMTP_PASS: "p" });

    expect(limits).toEqual({ globalPerMinute: 100, authPer15Minutes: 10, refreshPer15Minutes: 300, invitationPer15Minutes: 60, mfaPer15Minutes: 60 });
  });

  it("staging keeps the strict limits too", async () => {
    expect((await limitsFor({ NODE_ENV: "staging" })).authPer15Minutes).toBe(10);
  });

  it("development is roomier", async () => {
    expect(await limitsFor({ NODE_ENV: "development" })).toEqual({
      globalPerMinute: 2000,
      authPer15Minutes: 300,
      refreshPer15Minutes: 3000,
      invitationPer15Minutes: 600,
      mfaPer15Minutes: 600,
    });
  });

  it("a value set in the environment wins, in development as in production", async () => {
    expect((await limitsFor({ NODE_ENV: "development", AUTH_RATE_LIMIT_MAX: "7" })).authPer15Minutes).toBe(7);
    expect((await limitsFor({ NODE_ENV: "staging", AUTH_RATE_LIMIT_MAX: "50" })).authPer15Minutes).toBe(50);
  });
});
