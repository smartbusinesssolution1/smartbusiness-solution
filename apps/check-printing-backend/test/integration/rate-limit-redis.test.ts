import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createGlobalRateLimiter } from "../../src/middleware/rate-limiter.js";
import { producerConnection } from "../../src/jobs/queues.js";
import { getApp } from "../helpers/api.js";

// S5: the request counters live in Redis, shared by every server and kept across restarts.
// (The suite itself runs with a huge limit; these build limiters with small ones.)

const fresh = () => `rl:test:${randomUUID()}:`;

function serverWith(limiter: express.RequestHandler) {
  const app = express();
  app.get("/checks", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("Check Printing's request limit in Redis", () => {
  it("two servers share one budget", async () => {
    const prefix = fresh();
    const serverA = serverWith(createGlobalRateLimiter(2, { prefix }));
    const serverB = serverWith(createGlobalRateLimiter(2, { prefix }));

    expect((await request(serverA).get("/checks")).status).toBe(200);
    expect((await request(serverB).get("/checks")).status).toBe(200);
    expect((await request(serverA).get("/checks")).status).toBe(429);
  });

  // In production both APIs share one Redis; the prefix is what keeps their counters apart.
  it("the app counts under its own prefix (rl:check:), apart from platform-api's (rl:platform:)", async () => {
    await request(getApp()).get("/api/v1/health");

    const appKeys = (await producerConnection.keys("rl:*")).filter((k) => !k.startsWith("rl:test:"));
    expect(appKeys).not.toHaveLength(0);
    expect(appKeys.every((k) => k.startsWith("rl:check:global:"))).toBe(true);
  });
});
