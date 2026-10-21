import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAuthRateLimiter } from "../../src/middleware/rate-limiter.js";

// The suite runs with very high limits so it is never throttled. This proves the
// limiter itself: built with a small limit, the next attempt is refused with 429.
describe("auth rate limiter", () => {
  it("refuses the attempt after the limit with 429 and a retry hint", async () => {
    const app = express();
    app.post("/login", createAuthRateLimiter(3), (_req, res) => {
      res.json({ ok: true });
    });

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
    const signIn = createAuthRateLimiter(3);
    const refresh = createAuthRateLimiter(50);
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
