import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/api.js";

describe("GET /health", () => {
  it("answers healthy for load balancers and orchestrators", async () => {
    const res = await request(getApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "healthy" });
  });
});
