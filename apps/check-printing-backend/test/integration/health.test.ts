import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/api.js";

// S9: the public health check says healthy or degraded, nothing an attacker could use
// (it used to include the server's uptime and the database's response time).
describe("GET /api/v1/health", () => {
  it("answers healthy with the database reachable, and nothing more", async () => {
    const res = await request(getApp()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "healthy", database: { connected: true } } });
  });
});
