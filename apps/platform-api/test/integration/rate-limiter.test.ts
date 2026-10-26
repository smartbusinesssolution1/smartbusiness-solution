import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RateLimitRedis } from "@smartbusiness/auth";
import { createAuthRateLimiter, createGlobalRateLimiter } from "../../src/middleware/rate-limiter.js";
import { producerConnection } from "../../src/jobs/queues.js";
import { getApp } from "../helpers/auth-client.js";
import { logger } from "../../src/shared/services/logger.js";

// The suite runs with very high limits so it is never throttled. These prove the limiter
// itself, built with small limits. Counters live in Redis and outlast a test, so each test
// counts under its own prefix.
const fresh = () => `rl:test:${randomUUID()}:`;

// A tiny app behind one limiter: one "server".
function serverWith(limiter: express.RequestHandler) {
  const app = express();
  app.post("/login", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth rate limiter", () => {
  it("refuses the attempt after the limit with 429 and a retry hint", async () => {
    const app = serverWith(createAuthRateLimiter(3, { prefix: fresh() }));

    for (let i = 0; i < 3; i++) {
      expect((await request(app).post("/login")).status).toBe(200);
    }
    const blocked = await request(app).post("/login");

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("session refreshes have their own budget and never use up sign-in attempts", async () => {
    // The real app refreshes on every visit after the access token expires; with one
    // shared counter, a few page loads locked people out of signing in.
    const app = express();
    const signIn = createAuthRateLimiter(3, { prefix: fresh() });
    const refresh = createAuthRateLimiter(50, { prefix: fresh() });
    app.post("/login", signIn, (_req, res) => { res.json({ ok: true }); });
    app.post("/refresh", refresh, (_req, res) => { res.json({ ok: true }); });

    for (let i = 0; i < 20; i++) {
      expect((await request(app).post("/refresh")).status).toBe(200);
    }
    expect((await request(app).post("/login")).status).toBe(200);
  });

  it("the auth routes use the separate refresh limiter for /refresh", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../src/modules/auth/auth.routes.ts", import.meta.url), "utf8"));
    expect(source).toMatch(/router\.post\("\/refresh", refreshRateLimiter,/);
    expect(source).toMatch(/router\.post\(\s*"\/login",\s*authRateLimiter,/);
  });

  it("the invitation routes use their own limiter, never the sign-in budget", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../src/modules/auth/auth.routes.ts", import.meta.url), "utf8"));
    expect(source).toMatch(/router\.post\("\/invitations\/inspect", invitationRateLimiter,/);
    expect(source).toMatch(/router\.post\("\/invitations\/accept", invitationRateLimiter,/);
  });
});

// S5: counters in Redis, shared by every server and kept across restarts.
describe("counters shared through Redis", () => {
  it("two servers share one budget: 3 attempts in total, not 3 each", async () => {
    const prefix = fresh();
    const serverA = serverWith(createAuthRateLimiter(3, { prefix }));
    const serverB = serverWith(createAuthRateLimiter(3, { prefix }));

    expect((await request(serverA).post("/login")).status).toBe(200);
    expect((await request(serverB).post("/login")).status).toBe(200);
    expect((await request(serverA).post("/login")).status).toBe(200);

    expect((await request(serverB).post("/login")).status).toBe(429);
    expect((await request(serverA).post("/login")).status).toBe(429);
  });

  it("a restart doesn't reset the count: the new server carries on where the old one stopped", async () => {
    const prefix = fresh();
    const beforeRestart = serverWith(createAuthRateLimiter(3, { prefix }));
    for (let i = 0; i < 3; i++) await request(beforeRestart).post("/login");

    const afterRestart = serverWith(createAuthRateLimiter(3, { prefix }));

    expect((await request(afterRestart).post("/login")).status).toBe(429);
  });

  it("attempts arriving at the same instant on two servers are counted exactly (10 of 20 get in)", async () => {
    const prefix = fresh();
    const servers = [serverWith(createAuthRateLimiter(10, { prefix })), serverWith(createAuthRateLimiter(10, { prefix }))];

    const statuses = await Promise.all(Array.from({ length: 20 }, (_v, i) => request(servers[i % 2]!).post("/login").then((r) => r.status)));

    expect(statuses.filter((s) => s === 200)).toHaveLength(10);
    expect(statuses.filter((s) => s === 429)).toHaveLength(10);
  });

  it("a counter deletes itself when its window ends (it expires in Redis)", async () => {
    const prefix = fresh();
    await request(serverWith(createAuthRateLimiter(3, { prefix }))).post("/login");

    const [key] = await producerConnection.keys(`${prefix}*`);
    const ttl = await producerConnection.pttl(key!);

    expect(ttl).toBeGreaterThan(14 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("limiters with different prefixes never share counters", async () => {
    const signIn = serverWith(createAuthRateLimiter(1, { prefix: fresh() }));
    const other = serverWith(createAuthRateLimiter(1, { prefix: fresh() }));
    await request(signIn).post("/login");

    expect((await request(signIn).post("/login")).status).toBe(429);
    expect((await request(other).post("/login")).status).toBe(200);
  });

  it("the app's own limiters count in Redis under platform-api's prefix", async () => {
    await request(getApp()).get("/api/v1/auth/me");

    expect(await producerConnection.keys("rl:platform:global:*")).not.toHaveLength(0);
  });
});

// Decision: if Redis can't be reached, each server counts in its own memory (the old
// behaviour) and logs a warning, instead of letting everyone through or refusing everyone.
describe("when Redis can't be reached", () => {
  const brokenRedis = (): RateLimitRedis => ({ eval: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:6379")) });

  it("the limit still holds, counted in this server's memory", async () => {
    const app = serverWith(createGlobalRateLimiter(3, { prefix: fresh(), redis: brokenRedis() }));

    for (let i = 0; i < 3; i++) {
      expect((await request(app).post("/login")).status).toBe(200);
    }
    expect((await request(app).post("/login")).status).toBe(429);
  });

  it("logs a warning, once, not on every request", async () => {
    const warn = vi.spyOn(logger, "warn");
    const app = serverWith(createGlobalRateLimiter(100, { prefix: fresh(), redis: brokenRedis() }));

    for (let i = 0; i < 5; i++) await request(app).post("/login");

    const warnings = warn.mock.calls.filter(([, message]) => message === "Rate limiting: Redis unreachable, counting in memory");
    expect(warnings).toHaveLength(1);
  });

  it("goes back to Redis as soon as it answers again", async () => {
    const prefix = fresh();
    let down = true;
    const flaky: RateLimitRedis = {
      eval: (...args) => (down ? Promise.reject(new Error("down")) : producerConnection.eval(...args)),
    };
    const app = serverWith(createGlobalRateLimiter(100, { prefix, redis: flaky }));
    await request(app).post("/login");

    down = false;
    await request(app).post("/login");

    expect(await producerConnection.keys(`${prefix}*`)).toHaveLength(1);
  });
});
