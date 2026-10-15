import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserTokenService } from "@smartbusiness/auth";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp } from "../helpers/auth-client.js";
import { outbox, settle, tokenFrom, waitForEmail } from "../helpers/emails.js";
import { emailQueue, startTestWorker, stopTestWorker, waitForQueueIdle } from "../helpers/worker.js";

// Q1: forgot-password runs through the durable job queue (BullMQ on Redis).

const EMAIL = "maria@greenacres.test";
const forgot = (email: string) => new AuthClient().post("/api/v1/auth/forgot-password", { email });

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  await new AuthClient().register();
  outbox.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("forgot-password through the job queue", () => {
  it("queues a job for every email, known or not, so the request never looks anything up", async () => {
    await stopTestWorker();

    await forgot(EMAIL);
    await forgot("nobody@greenacres.test");

    const jobs = await emailQueue.raw.getJobs(["waiting"]);
    expect(jobs.map((j) => j.data.email).sort()).toEqual([EMAIL, "nobody@greenacres.test"]);
  });

  it("puts no secret in the job: only the email and the requester's IP", async () => {
    await stopTestWorker();
    await forgot(EMAIL);

    const [job] = await emailQueue.raw.getJobs(["waiting"]);
    expect(Object.keys(job!.data).sort()).toEqual(["email", "ipAddress"]);
    expect(await prisma.userToken.count()).toBe(0);
  });

  it("keeps the request safe while no worker is running, and delivers once one starts", async () => {
    await stopTestWorker();

    expect((await forgot(EMAIL)).status).toBe(202);
    await settle(300);
    expect(outbox.to(EMAIL)).toEqual([]);
    expect(await emailQueue.pendingCount()).toBe(1);

    startTestWorker();
    await waitForEmail(EMAIL, "password-reset");
  });

  it("retries when sending fails, and the link that finally arrives is the only one that works", async () => {
    const send = outbox.send.bind(outbox);
    vi.spyOn(outbox, "send")
      .mockRejectedValueOnce(new Error("email provider timeout"))
      .mockRejectedValueOnce(new Error("email provider timeout"))
      .mockImplementation(send);

    await forgot(EMAIL);
    const email = await waitForEmail(EMAIL, "password-reset", 5_000);
    const delivered = tokenFrom(email, "/reset-password");

    // Three attempts issued three links; the two that were never delivered are revoked.
    const issued = await prisma.userToken.findMany({ where: { purpose: "PASSWORD_RESET" } });
    expect(issued).toHaveLength(3);
    expect(issued.filter((t) => t.revokedAt === null)).toHaveLength(1);
    expect((await new UserTokenService().inspect(delivered, "PASSWORD_RESET")).ok).toBe(true);
    expect(outbox.to(EMAIL, "password-reset")).toHaveLength(1);
  });

  it("keeps a job that failed every attempt in the failed list, with the reason", async () => {
    vi.spyOn(outbox, "send").mockRejectedValue(new Error("email provider down"));

    await forgot(EMAIL);
    await waitForQueueIdle();

    const failed = await emailQueue.raw.getJobs(["failed"]);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.attemptsMade).toBe(5);
    expect(failed[0]!.failedReason).toBe("email provider down");
  });

  it("answers 503 when the job cannot be queued, the same for every email", async () => {
    vi.spyOn(emailQueue, "add").mockRejectedValue(new Error("Redis unreachable"));

    const known = await forgot(EMAIL);
    const unknown = await forgot("nobody@greenacres.test");

    expect(known.status).toBe(503);
    expect(known.body.error).toEqual({
      code: "SERVICE_UNAVAILABLE",
      message: "We couldn't start the reset right now. Try again in a moment.",
    });
    expect(unknown.body).toEqual(known.body);
  });

  it("reports the job queue in the health check", async () => {
    const res = await request(getApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.jobQueue).toEqual({ connected: true });
  });
});
