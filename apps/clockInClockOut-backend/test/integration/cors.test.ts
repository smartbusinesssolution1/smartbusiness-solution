import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/api.js";

const APP = "http://localhost:5173";
const PORTAL = "http://localhost:5174";

function preflight(origin: string) {
  return request(getApp())
    .options("/api/v1/attendance/verify-location")
    .set("Origin", origin)
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "Content-Type,Authorization,X-Tenant-Id,X-Workspace-Id");
}

describe("CORS Security & Preflight Gateway", () => {
  it("allows configured application origin with credentials", async () => {
    const res = await preflight(APP);

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(APP);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows configured portal origin with credentials", async () => {
    const res = await preflight(PORTAL);

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(PORTAL);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("refuses unauthorized origin with no CORS permission", async () => {
    const res = await preflight("https://malicious.website.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
