import { afterEach, describe, expect, it, vi } from "vitest";

// The per-IP limit is strict by default outside development, roomier in development (one
// developer's machine sends every request), and a value set in the environment wins.

async function maxFor(env: Record<string, string | undefined>) {
  // Only the values given here: not whatever the developer's own .env says.
  vi.doMock("dotenv", () => ({ default: { config: () => ({}) } }));
  vi.resetModules();
  vi.stubEnv("RATE_LIMIT_MAX", undefined);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("./index.js")).rateLimit.max;
}

afterEach(() => {
  vi.doUnmock("dotenv");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rate limit default", () => {
  it("strict outside development", async () => {
    expect(await maxFor({ NODE_ENV: "staging", APP_URL: "https://app.example.com" })).toBe(100);
    expect(await maxFor({ NODE_ENV: "test" })).toBe(100);
  });

  it("roomier in development", async () => {
    expect(await maxFor({ NODE_ENV: "development" })).toBe(2000);
  });

  it("a value set in the environment wins", async () => {
    expect(await maxFor({ NODE_ENV: "development", RATE_LIMIT_MAX: "25" })).toBe(25);
  });
});
