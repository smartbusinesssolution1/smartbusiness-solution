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
});
