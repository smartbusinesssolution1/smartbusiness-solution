import { gzipSync } from "zlib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/auth-client.js";

// S2: local-network origins are allowed in development only. They used to be allowed
// whenever NODE_ENV wasn't "production" (staging, tests, or NODE_ENV forgotten).
describe("CORS outside development", () => {
  const preflightFrom = (origin: string) =>
    request(getApp())
      .options("/api/v1/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");

  it("a local-network origin is not allowed (tests run as NODE_ENV=test)", async () => {
    const res = await preflightFrom("http://192.168.1.20:5174");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("a configured origin still is", async () => {
    const res = await preflightFrom("http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

// S3: body-parser before 2.4.0 crashes the whole process on a crafted compressed body
// (GHSA-27r3-jxmh-p828), before routing is even reached. Browsers and the mobile app never
// compress what they send, so compressed bodies are refused before any decompression.
describe("compressed request bodies", () => {
  it("are refused with 415 (JSON)", async () => {
    const res = await request(getApp())
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(gzipSync(Buffer.from(JSON.stringify({ email: "maria@greenacres.test", password: "x" }))));

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_ENCODING");
  });

  it("are refused with 415 as a form too", async () => {
    const res = await request(getApp())
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("Content-Encoding", "gzip")
      .send(gzipSync(Buffer.from("email=maria%40greenacres.test&password=x")));

    expect(res.status).toBe(415);
  });
});
