import { gzipSync } from "zlib";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// S4: the login cookie goes with every request the browser sends to us, whichever website
// started it. A page elsewhere could make a signed-in visitor's browser change things here
// (CSRF). Changes requested by a page on a website we don't serve are now refused, and
// only JSON bodies are read (an HTML form can post form data cross-site without asking).
//
// The test environment serves http://localhost:5173 and http://localhost:5174.

const APP = "http://localhost:5173";
const NEW_WORKSPACE = { businessName: "Green Acres Design LLC", addressLine1: "1 Elm St", city: "Austin", state: "TX", zipCode: "78701" };

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

const createWorkspaceFrom = (origin: string | null) => {
  const req = request(getApp()).post("/api/v1/workspaces").set(authHeaders(world.admin));
  if (origin !== null) req.set("Origin", origin);
  return req.send(NEW_WORKSPACE);
};
const workspaceCount = () => prisma.workspace.count({ where: { tenantId: world.tenantId } });

describe("a change requested from another website", () => {
  it.each([
    ["https://evil.example", "another website"],
    ["http://localhost:5173.evil.example", "a look-alike address"],
    ["http://attacker.localhost:5173", "a subdomain (same site, so SameSite cookies are no help)"],
    ["null", "a sandboxed frame or a file opened from disk"],
  ])("is refused, and nothing changes: %s (%s)", async (origin) => {
    const before = await workspaceCount();

    const res = await createWorkspaceFrom(origin);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(await workspaceCount()).toBe(before);
  });

  it("is refused for PUT and DELETE too: the workspace is neither renamed nor deleted", async () => {
    const url = `/api/v1/workspaces/${world.workspaceId}`;
    const rename = await request(getApp()).put(url).set(authHeaders(world.admin)).set("Origin", "https://evil.example").send({ businessName: "Hacked LLC" });
    const remove = await request(getApp()).delete(url).set(authHeaders(world.admin)).set("Origin", "https://evil.example");

    expect([rename.status, remove.status]).toEqual([403, 403]);
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: world.workspaceId } });
    expect(workspace.businessName).toBe("Green Acres Landscaping LLC");
    expect(workspace.deletedAt).toBeNull();
  });

  it("is refused for a file upload too (a form can send files)", async () => {
    const res = await request(getApp())
      .put(`/api/v1/workspaces/${world.workspaceId}/bank-accounts/${world.bankAccountId}/signature`)
      .set(authHeaders(world.admin))
      .set("Origin", "https://evil.example")
      .attach("signature", Buffer.from("not really a png"), { filename: "signature.png", contentType: "image/png" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("is refused before its body is read: 403, not the 415 a compressed body gets", async () => {
    const res = await request(getApp())
      .post("/api/v1/workspaces")
      .set(authHeaders(world.admin))
      .set("Origin", "https://evil.example")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(gzipSync(Buffer.from(JSON.stringify(NEW_WORKSPACE))));

    expect(res.status).toBe(403);
  });
});

describe("what keeps working", () => {
  it("our app makes the change", async () => {
    expect((await createWorkspaceFrom(APP)).status).toBe(201);
  });

  it("a request with no Origin (not started by a browser: scripts, server-to-server) makes the change", async () => {
    expect((await createWorkspaceFrom(null)).status).toBe(201);
  });

  it("reading is not blocked: another website's GET is answered, and CORS keeps the answer from it", async () => {
    const res = await request(getApp()).get("/api/v1/workspaces").set(authHeaders(world.admin)).set("Origin", "https://evil.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("JSON bodies only", () => {
  it("a form-encoded body is not read, even from our own app: the workspace isn't created", async () => {
    const before = await workspaceCount();

    const res = await request(getApp())
      .post("/api/v1/workspaces")
      .set(authHeaders(world.admin))
      .set("Origin", APP)
      .type("form")
      .send(NEW_WORKSPACE);

    expect(res.status).toBe(400);
    expect(await workspaceCount()).toBe(before);
  });
});
