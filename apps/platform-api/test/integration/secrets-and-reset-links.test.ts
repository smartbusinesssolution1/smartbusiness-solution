import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import request from "supertest";
import { resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp, VALID_PASSWORD } from "../helpers/auth-client.js";
import { outbox, waitForEmail } from "../helpers/emails.js";
import type { SentEmail } from "@smartbusiness/email";
import { logger } from "../../src/shared/services/logger.js";

// Security review of the clockIn-clockOut merge (project-docs/PLATFORM_API_SECURITY_REVIEW_CLOCKIN_MERGE.md):
//   1. password-reset links (with their token) were written to the logs
//   2. new users' passwords were written to the logs
//   4. a reset link could be pointed at any private-network address the caller chose
// A reset link or a password in a log is a leaked one: logs are read by many people and
// kept for a long time. And a reset link may only ever open one of OUR websites.

const EMAIL = "maria@greenacres.test";
const APP_URL = "https://app.smartbusiness.test"; // test-env.ts
const CLOCK_IN = "http://localhost:5174"; // in the test CORS_ORIGIN, like Clock-In's real address in production

// What would actually land in the log files while it runs: the lines pino writes (after its
// serializers and redaction; the test logger is "silent", so it is turned up to every level
// for the test), plus anything printed with console.*.
function captureLogs() {
  const lines: string[] = [];
  const stream = (logger as unknown as Record<symbol, { write(chunk: string): boolean }>)[pino.symbols.streamSym]!;
  const previousLevel = logger.level;
  logger.level = "trace";
  const spies = [
    vi.spyOn(stream, "write").mockImplementation((chunk: string) => (lines.push(String(chunk)), true)),
    ...(["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        // inspect, not JSON.stringify: objects such as requests refer to themselves.
        lines.push(args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 6, breakLength: Infinity }))).join(" "));
      }),
    ),
  ];
  return {
    text: () => lines.join("\n"),
    restore: () => {
      spies.forEach((s) => s.mockRestore());
      logger.level = previousLevel;
    },
  };
}

// The reset link in the email, whichever form it uses (#token= or ?token=).
function resetLinkIn(email: SentEmail): { url: string; token: string } {
  const match = email.text.match(/(\S+\/reset-password[#?]token=([A-Za-z0-9_-]+))/);
  if (!match) throw new Error("No reset link in the email");
  return { url: match[1]!, token: match[2]! };
}

const forgot = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const req = request(getApp()).post("/api/v1/auth/forgot-password").send(body);
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
};

let logs: ReturnType<typeof captureLogs>;

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  await new AuthClient().register();
  outbox.clear();
  logs = captureLogs();
});

afterEach(() => {
  logs.restore();
});

describe("no secrets in the logs", () => {
  it("password reset: neither the link nor its token is logged", async () => {
    await forgot({ email: EMAIL });
    const { url, token } = resetLinkIn(await waitForEmail(EMAIL, "password-reset"));

    expect(logs.text()).not.toContain(token);
    expect(logs.text()).not.toContain(url);
    // It is still recorded THAT a link was made (without the link).
    expect(logs.text()).toContain("Password reset link created");
  });

  it("sign-up with a chosen password: the password is not logged", async () => {
    const chosen = "Chosen-Pass#2026";
    await new AuthClient().register({ email: "david@sunshine.test", companyName: "Sunshine Pools", password: chosen });

    expect(logs.text()).not.toContain(chosen);
  });

  it("sign-up and its welcome email: the chosen password is not logged", async () => {
    const chosen = "Welcome-Pass#2026";
    await new AuthClient().register({ email: "emily@lakeside.test", companyName: "Lakeside Co", password: chosen });
    await waitForEmail("emily@lakeside.test", "welcome");

    expect(logs.text()).not.toContain(chosen);
  });
});

describe("where a reset link may point", () => {
  async function linkFor(body: Record<string, unknown>, headers?: Record<string, string>): Promise<string> {
    const res = await forgot({ email: EMAIL, ...body }, headers);
    expect(res.status).toBe(202);
    return resetLinkIn(await waitForEmail(EMAIL, "password-reset")).url;
  }

  it.each([
    ["a laptop on the office network", "http://192.168.1.50"],
    ["another private-network address", "http://10.0.0.7:8080"],
    ["a 172.16-31 private address", "http://172.20.5.9"],
    ["this machine", "http://localhost:4444"],
    ["another website", "https://evil.example"],
  ])("refuses %s (%s): the link opens APP_URL instead", async (_label, redirectUrl) => {
    const link = await linkFor({ redirectUrl });

    expect(link.startsWith(`${APP_URL}/reset-password`)).toBe(true);
    expect(link).not.toContain(new URL(redirectUrl).host);
  });

  it("keeps sending Clock-In users to Clock-In: one of our own addresses is used", async () => {
    expect((await linkFor({ redirectUrl: CLOCK_IN })).startsWith(`${CLOCK_IN}/reset-password`)).toBe(true);
  });

  it("uses only the address's origin, never a path someone put after it", async () => {
    const link = await linkFor({ redirectUrl: `${CLOCK_IN}/somewhere/else` });

    expect(link.startsWith(`${CLOCK_IN}/reset-password`)).toBe(true);
  });

  it("follows the Origin header of our own app when no redirectUrl is sent", async () => {
    expect((await linkFor({}, { Origin: CLOCK_IN })).startsWith(`${CLOCK_IN}/reset-password`)).toBe(true);
  });

  it("a malformed Referer header is ignored instead of failing the request", async () => {
    expect((await linkFor({}, { Referer: "not a url" })).startsWith(`${APP_URL}/reset-password`)).toBe(true);
  });
});
