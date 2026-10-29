import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/api.js";

describe("Protected Routes Security Gateway", () => {
  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const res = await request(getApp()).get("/api/v1/attendance/today");

    expect(res.status).toBe(401);
  });

  it("rejects requests missing tenant identifier", async () => {
    // Valid bearer token format but without X-Tenant-Id header
    const res = await request(getApp())
      .get("/api/v1/attendance/today")
      .set("Cookie", "access_token=some-untrusted-token");

    expect(res.status).toBe(401);
  });
});
