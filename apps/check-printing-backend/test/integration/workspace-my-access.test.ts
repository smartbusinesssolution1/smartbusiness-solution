import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";

// The web app shows each person only the actions they can take. It learns them from
// GET /workspaces/:wid, because only admins may read the members list.

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
});

const getWorkspace = (user: TestUser) =>
  request(getApp()).get(`/api/v1/workspaces/${world.workspaceId}`).set(authHeaders(user));

describe("GET /workspaces/:wid tells the caller what they may do", () => {
  it("a printer sees only the printer role and its permissions", async () => {
    const res = await getWorkspace(world.printer);
    expect(res.status).toBe(200);
    expect(res.body.data.myAccess.roles).toEqual(["check-printer"]);
    expect([...res.body.data.myAccess.permissions].sort()).toEqual(["check:print", "check:view"]);
  });

  it("an admin sees every permission, including member and workspace management", async () => {
    const res = await getWorkspace(world.admin);
    expect(res.body.data.myAccess.roles).toEqual(["check-admin"]);
    expect(res.body.data.myAccess.permissions).toEqual(
      expect.arrayContaining(["workspace:manage", "member:manage", "check:void", "bank-account:manage"]),
    );
  });

  it("a viewer cannot read the members list, but still learns their own access", async () => {
    const members = await request(getApp())
      .get(`/api/v1/workspaces/${world.workspaceId}/members`)
      .set(authHeaders(world.viewer));
    expect(members.status).toBe(403);

    const res = await getWorkspace(world.viewer);
    expect(res.status).toBe(200);
    expect([...res.body.data.myAccess.permissions].sort()).toEqual(["check:view", "report:view"]);
  });
});
