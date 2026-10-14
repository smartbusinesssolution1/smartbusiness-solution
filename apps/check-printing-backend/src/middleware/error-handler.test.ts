import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { Prisma } from "@smartbusiness/database";
import { errorHandler } from "./error-handler.js";
import { createApp } from "../app.js";

// Phase 0.4: database and request-parsing failures reach the client as clear,
// retryable statuses, never as a 500 that leaks Prisma's wording.

function prismaError(code: string, message = "Invalid `prisma.check.create()` invocation: payeeName: \"Jane Doe\"") {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "7.10.0",
    meta: { modelName: "Check" },
  });
}

function appThrowing(err: unknown) {
  const app = express();
  app.get("/boom", () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler: Prisma errors", () => {
  it.each([
    ["P2002", 409, "CONFLICT"],
    ["P2025", 404, "NOT_FOUND"],
    ["P2028", 503, "SERVICE_BUSY"],
    ["P2034", 409, "CONFLICT"],
    ["P2024", 503, "SERVICE_BUSY"],
    ["P1001", 503, "DATABASE_UNAVAILABLE"],
  ])("maps %s to %i %s", async (code, status, errorCode) => {
    const res = await request(appThrowing(prismaError(code))).get("/boom");

    expect(res.status).toBe(status);
    expect(res.body).toEqual({
      success: false,
      error: { code: errorCode, message: expect.any(String) },
    });
  });

  it("never returns Prisma's own message, which can contain request data", async () => {
    const res = await request(appThrowing(prismaError("P2002"))).get("/boom");
    expect(JSON.stringify(res.body)).not.toContain("Jane Doe");
    expect(JSON.stringify(res.body)).not.toContain("prisma.check");
  });

  it("asks the client to retry after a busy or unavailable database", async () => {
    expect((await request(appThrowing(prismaError("P2028"))).get("/boom")).headers["retry-after"]).toBe("5");
    expect((await request(appThrowing(prismaError("P1001"))).get("/boom")).headers["retry-after"]).toBe("10");
  });

  it("maps a client initialization failure to 503", async () => {
    const err = new Prisma.PrismaClientInitializationError("Can't reach database server", "7.10.0");
    const res = await request(appThrowing(err)).get("/boom");
    expect(res.status).toBe(503);
  });

  it("keeps unknown Prisma codes and plain errors as a generic 500", async () => {
    expect((await request(appThrowing(prismaError("P2003"))).get("/boom")).status).toBe(500);
    const res = await request(appThrowing(new Error("disk on fire"))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("errorHandler: request bodies", () => {
  const app = createApp();

  it("answers malformed JSON with 400 INVALID_JSON", async () => {
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set("Content-Type", "application/json")
      .send('{"businessName": "Acme",');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("answers a body over 100 KB with 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ memo: "x".repeat(110 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
