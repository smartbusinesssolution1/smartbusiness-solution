import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, today, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// R-14: what the API tells BROWSERS. CORS is enforced by the browser, not the server, so
// supertest (like curl) would happily send any header. These tests send the headers a browser
// sends and check the server's answer, which is exactly what a browser obeys.
//
// The test environment allows two frontends: http://localhost:5173 and http://localhost:5174.

const APP = "http://localhost:5173";
const PORTAL = "http://localhost:5174";

// The question a browser asks before a cross-origin POST with custom headers.
function preflight(origin: string, headers = "content-type,x-tenant-id,idempotency-key,x-request-id") {
  return request(getApp())
    .options("/api/v1/workspaces/any/checks")
    .set("Origin", origin)
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", headers);
}

const listOf = (header: string | undefined) =>
  (header ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

describe("CORS: what browsers are allowed to do", () => {
  describe("the preflight (the browser asks before sending)", () => {
    it("lets our app send the Idempotency-Key, so double-click protection can work", async () => {
      const res = await preflight(APP);

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(APP);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(listOf(res.headers["access-control-allow-headers"])).toEqual(
        expect.arrayContaining(["content-type", "x-tenant-id", "idempotency-key", "x-request-id"]),
      );
    });

    it("lets the browser remember the answer for 10 minutes", async () => {
      const res = await preflight(APP);
      expect(res.headers["access-control-max-age"]).toBe("600");
    });

    it("allows every configured frontend, each by its exact origin", async () => {
      const res = await preflight(PORTAL);
      expect(res.headers["access-control-allow-origin"]).toBe(PORTAL);
    });

    it.each(["https://evil.example", "http://localhost:5173.evil.example", "null"])(
      "gives no permission to %s",
      async (origin) => {
        const res = await preflight(origin);
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      },
    );

    it("tells caches that the answer depends on the Origin", async () => {
      const res = await preflight(APP);
      expect(listOf(res.headers["vary"])).toContain("origin");
    });
  });

  describe("real requests from our app", () => {
    let world: TestWorld;

    beforeEach(async () => {
      await resetDatabase();
      world = await createWorld();
    });

    it("a create retried with the same Idempotency-Key returns the same check, and the app can see it was replayed", async () => {
      const key = randomUUID();
      const send = () =>
        request(getApp())
          .post(`/api/v1/workspaces/${world.workspaceId}/checks`)
          .set(authHeaders(world.editor))
          .set("Origin", APP)
          .set("Idempotency-Key", key)
          .send({ bankAccountId: world.bankAccountId, payeeName: "Hill Country Supply Co.", amount: 1250.5, checkDate: today() });

      const first = await send();
      const retry = await send();

      expect(first.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(retry.body.data.id).toBe(first.body.data.id);
      expect(retry.headers["idempotent-replayed"]).toBe("true");
      expect(listOf(retry.headers["access-control-expose-headers"])).toContain("idempotent-replayed");
    });

    it("lets the app read the request id, wait time and download file name", async () => {
      const res = await request(getApp())
        .get(`/api/v1/workspaces/${world.workspaceId}/checks`)
        .set(authHeaders(world.viewer))
        .set("Origin", APP);

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(APP);
      expect(listOf(res.headers["access-control-expose-headers"])).toEqual(
        expect.arrayContaining(["x-request-id", "idempotent-replayed", "retry-after", "content-disposition"]),
      );
    });
  });
});
