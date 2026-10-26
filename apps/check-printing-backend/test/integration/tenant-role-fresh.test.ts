import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { tenantMiddleware } from "@smartbusiness/auth";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createWorld, type TestWorld } from "../helpers/fixtures.js";

// The organization role on req.tenant is read fresh on every request. Clock-In grants admin
// rights from it (requireAdmin), so a demoted admin must lose them on the next request.

let world: TestWorld;

function appAs(userId: string) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { userId, email: "x@example.com", amr: ["pwd"] };
    next();
  });
  app.get("/whoami", tenantMiddleware, (req, res) => {
    res.json({ role: req.tenant!.role, tenantId: req.tenant!.tenantId });
  });
  app.use((err: { statusCode?: number; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ message: err.message });
  });
  return app;
}

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

describe("the organization role on each request", () => {
  it("is the current role: a demotion applies to the very next request", async () => {
    const app = appAs(world.admin.id);
    const first = await request(app).get("/whoami").set("X-Tenant-Id", world.tenantId);
    expect(first.body).toEqual({ role: "OWNER", tenantId: world.tenantId });

    await prisma.tenantMember.updateMany({ where: { tenantId: world.tenantId, userId: world.admin.id }, data: { role: "MEMBER" } });

    const next = await request(app).get("/whoami").set("X-Tenant-Id", world.tenantId);
    expect(next.body.role).toBe("MEMBER");
  });

  it("refuses an organization the user does not belong to (a made-up id is not an error)", async () => {
    const res = await request(appAs(world.admin.id)).get("/whoami").set("X-Tenant-Id", "not-a-real-tenant");
    expect(res.status).toBe(403);
  });
});
