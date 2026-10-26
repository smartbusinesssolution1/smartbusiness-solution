import { gzipSync } from "zlib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/api.js";

// S3: body-parser before 2.4.0 crashes the whole process on a crafted compressed body
// (GHSA-27r3-jxmh-p828), before routing or sign-in are even reached. Browsers never
// compress what they send, so compressed bodies are refused before any decompression.

const gzipped = (body: string) => gzipSync(Buffer.from(body));

describe("compressed request bodies", () => {
  it("are refused with 415 before sign-in is checked (JSON)", async () => {
    const res = await request(getApp())
      .post("/api/v1/workspaces")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(gzipped(JSON.stringify({ businessName: "Green Acres" })));

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_ENCODING");
  });

  it("an ordinary JSON body still reaches the route (here: sign-in required)", async () => {
    const res = await request(getApp()).post("/api/v1/workspaces").send({ businessName: "Green Acres" });

    expect(res.status).toBe(401);
  });
});
