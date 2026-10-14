import { Writable } from "stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { Prisma } from "@smartbusiness/database";
import { REDACT_PATHS, serializeError } from "./logger.js";

// Phase 0.7: bank details and Prisma query arguments never reach a log line.

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const log = pino(
    { redact: { paths: REDACT_PATHS, censor: "[REDACTED]" }, serializers: { err: serializeError } },
    stream,
  );
  return { log, output: () => lines.join("") };
}

describe("logger redaction", () => {
  it.each([
    ["top level", { accountNumber: "987654321012" }],
    ["one level deep", { body: { routingNumber: "111000025" } }],
    ["two levels deep", { audit: { details: { accountNumber: "987654321012" } } }],
    ["encrypted fields", { account: { accountNumberEncrypted: "aa:bb:cc" } }],
    ["credentials", { user: { password: "Password1!", refreshToken: "rt_123" } }],
  ])("redacts sensitive fields: %s", (_label, payload) => {
    const { log, output } = captureLogger();
    log.info(payload, "event");

    expect(output()).toContain("[REDACTED]");
    for (const secret of ["987654321012", "111000025", "aa:bb:cc", "Password1!", "rt_123"]) {
      expect(output()).not.toContain(secret);
    }
  });

  it("redacts the cookie and authorization headers", () => {
    const { log, output } = captureLogger();
    log.info({ req: { headers: { cookie: "access_token=abc", authorization: "Bearer xyz" } } }, "request");
    expect(output()).not.toContain("access_token=abc");
    expect(output()).not.toContain("Bearer xyz");
  });
});

describe("logger error serializer", () => {
  it("drops the message and message-bearing stack line of Prisma errors", () => {
    const err = new Prisma.PrismaClientValidationError(
      'Invalid `prisma.check.create()` invocation:\n{ data: { payeeName: "Jane Doe", amount: 9999 } }',
      { clientVersion: "7.10.0" },
    );
    const { log, output } = captureLogger();
    log.error({ err }, "failed");

    expect(output()).toContain("PrismaClientValidationError");
    expect(output()).not.toContain("Jane Doe");
    expect(output()).not.toContain("9999");
  });

  it("keeps the code and metadata of known Prisma errors", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed: payee Jane Doe", {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: { modelName: "Check" },
    });
    const serialized = serializeError(err) as Record<string, unknown>;

    expect(serialized.code).toBe("P2002");
    expect(serialized.meta).toEqual({ modelName: "Check" });
    expect(JSON.stringify(serialized)).not.toContain("Jane Doe");
  });

  it("serializes ordinary errors normally", () => {
    const serialized = serializeError(new Error("disk full")) as Record<string, unknown>;
    expect(serialized.message).toBe("disk full");
    expect(serialized.type).toBe("Error");
  });
});
