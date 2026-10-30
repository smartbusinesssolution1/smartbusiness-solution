import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp, VALID_PASSWORD } from "../helpers/auth-client.js";
import { outbox, settle, waitForEmail } from "../helpers/emails.js";
import { emailQueue, waitForQueueIdle } from "../helpers/worker.js";

// Sign-up and the welcome email (security review of the clockIn-clockOut merge, items 1-4):
//   1. no email ever contains the password (the old "credentials" email sent it back)
//   2. a password is required: nothing is generated, nothing is substituted
//   3. the welcome email links back to OUR app the person signed up on
//   4. it is queued like every other email, and the job holds no secret

const EMAIL = "owner@lakeside.test";
const COMPANY = "Lakeside Landscaping";
const PORTAL = "http://localhost:3003"; // in the test CORS_ORIGIN, like the portal's address in production
const APP_URL = "https://app.smartbusiness.test"; // test-env.ts

const signUp = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const req = request(getApp())
    .post("/api/v1/auth/register")
    .send({ fullName: "Lena Lake", email: EMAIL, companyName: COMPANY, password: VALID_PASSWORD, ...body });
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
};

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  outbox.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a password is required", () => {
  it("without one, sign-up is refused: no account, no company, no email", async () => {
    const res = await signUp({ password: undefined });

    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toBeDefined();
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.tenant.count()).toBe(0);
    await settle();
    expect(outbox.sent).toEqual([]);
  });

  it("the password chosen is exactly the one that works, even 'Password1!' (nothing is substituted)", async () => {
    expect((await signUp({ password: "Password1!" })).status).toBe(201);

    expect((await new AuthClient().login(EMAIL, "Password1!")).status).toBe(200);
  });
});

describe("the welcome email", () => {
  it("welcomes the owner and links back to the portal they signed up on, without the password", async () => {
    expect((await signUp({}, { Origin: PORTAL })).status).toBe(201);

    const email = await waitForEmail(EMAIL, "welcome");
    expect(email.subject).toBe(`Welcome to SmartBusiness, ${COMPANY}`);
    expect(email.text).toContain("Hi Lena Lake,");
    expect(email.text).toContain(PORTAL);
    expect(`${email.text}${email.html}`).not.toContain(VALID_PASSWORD);
    expect(`${email.text}${email.html}`).not.toMatch(/password\s*:/i);
  });

  it("is the only email: no 'credentials' email is sent any more", async () => {
    await signUp({}, { Origin: PORTAL });
    await waitForEmail(EMAIL, "welcome");
    await waitForQueueIdle();
    await settle();

    expect(outbox.sent.map((e) => e.tag)).toEqual(["welcome"]);
  });

  it("without an address of ours, it links to APP_URL", async () => {
    await signUp({});

    expect((await waitForEmail(EMAIL, "welcome")).text).toContain(APP_URL);
  });

  it("never links to another website named in the request", async () => {
    await signUp({}, { Referer: "https://evil.example/landing" });

    const email = await waitForEmail(EMAIL, "welcome");
    expect(email.text).toContain(APP_URL);
    expect(`${email.text}${email.html}`).not.toContain("evil.example");
  });
});

describe("queued, never holding a secret", () => {
  it("the job holds only the user's id and the app address", async () => {
    vi.spyOn(emailQueue, "add");
    const res = await signUp({}, { Origin: PORTAL });
    const userId = res.body.data.user.id;

    expect(emailQueue.add).toHaveBeenCalledWith("welcome-email", { userId, appUrl: PORTAL }, { jobId: `welcome-${userId}` });
    const queued = JSON.stringify(vi.mocked(emailQueue.add).mock.calls);
    expect(queued).not.toContain(VALID_PASSWORD);
  });

  it("sign-up still succeeds when the queue is unreachable; only the welcome email is missing", async () => {
    vi.spyOn(emailQueue, "add").mockRejectedValue(new Error("Redis unreachable"));

    const res = await signUp({}, { Origin: PORTAL });

    expect(res.status).toBe(201);
    expect((await new AuthClient().login(EMAIL, VALID_PASSWORD)).status).toBe(200);
  });

  it("an account removed before the job runs gets no email", async () => {
    vi.spyOn(emailQueue, "add").mockResolvedValueOnce("held-back");
    const res = await signUp({}, { Origin: PORTAL });
    const userId = res.body.data.user.id;
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    vi.restoreAllMocks();

    await emailQueue.add("welcome-email", { userId, appUrl: PORTAL });
    await waitForQueueIdle();
    await settle();

    expect(outbox.sent).toEqual([]);
  });
});
