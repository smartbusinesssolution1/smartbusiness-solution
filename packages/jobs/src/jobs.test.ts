import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Redis } from "ioredis";
import {
  createProducerConnection,
  createTypedWorker,
  createWorkerConnection,
  TypedQueue,
  type Worker,
} from "./index.js";

// Against the disposable test Redis (pnpm --filter @smartbusiness/check-printing-backend test:db:up).
// Database 2 is this package's; it is emptied before the run.
const REDIS_URL = process.env.JOBS_TEST_REDIS_URL ?? "redis://127.0.0.1:63790/2";

interface TestJobs {
  greet: { name: string };
  flaky: { failTimes: number };
  slow: { ms: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => Promise<boolean> | boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Condition not met in time");
    await sleep(20);
  }
}

let producer: Redis;
let workerConn: Redis;
const toClose: Array<{ close: () => Promise<unknown> }> = [];

beforeAll(async () => {
  producer = createProducerConnection(REDIS_URL, { enableOfflineQueue: true });
  workerConn = createWorkerConnection(REDIS_URL);
  await producer.flushdb();
});

afterEach(async () => {
  while (toClose.length) await toClose.pop()!.close();
});

afterAll(async () => {
  await producer.quit();
  await workerConn.quit();
});

function newQueue(backoffMs = 20, attempts = 5) {
  const queue = new TypedQueue<TestJobs>(`test-${randomUUID()}`, producer, { attempts, backoffMs });
  toClose.push(queue);
  return queue;
}

function startWorker(queue: TypedQueue<TestJobs>, log: string[], hooks: Parameters<typeof createTypedWorker>[3] = {}) {
  const attemptsSeen = new Map<string, number>();
  const worker: Worker = createTypedWorker<TestJobs>(
    queue.name,
    {
      greet: async ({ name }) => {
        log.push(`hello ${name}`);
      },
      flaky: async ({ failTimes }, job) => {
        const n = (attemptsSeen.get(job.id!) ?? 0) + 1;
        attemptsSeen.set(job.id!, n);
        if (n <= failTimes) throw new Error(`attempt ${n} failed`);
        log.push(`succeeded on attempt ${n}`);
      },
      slow: async ({ ms }) => {
        await sleep(ms);
        log.push(`slept ${ms}`);
      },
    },
    workerConn,
    hooks,
  );
  toClose.push(worker);
  return worker;
}

describe("job queue", () => {
  it("delivers a typed job to its processor", async () => {
    const queue = newQueue();
    const log: string[] = [];
    startWorker(queue, log);

    await queue.add("greet", { name: "Maria" });
    await until(() => log.length === 1);
    expect(log).toEqual(["hello Maria"]);
  });

  it("keeps a job safe in Redis while no worker is running, and runs it once one starts", async () => {
    const queue = newQueue();
    await queue.add("greet", { name: "Jennifer" });
    expect(await queue.pendingCount()).toBe(1);

    const log: string[] = [];
    startWorker(queue, log);
    await until(() => log.length === 1);
    expect(await queue.pendingCount()).toBe(0);
  });

  it("retries a failing job with backoff until it succeeds", async () => {
    const queue = newQueue();
    const log: string[] = [];
    const failures: Array<{ attempt: number; willRetry: boolean }> = [];
    startWorker(queue, log, { onFailed: (f) => failures.push({ attempt: f.attempt, willRetry: f.willRetry }) });

    await queue.add("flaky", { failTimes: 2 });
    await until(() => log.length === 1);

    expect(log).toEqual(["succeeded on attempt 3"]);
    expect(failures).toEqual([
      { attempt: 1, willRetry: true },
      { attempt: 2, willRetry: true },
    ]);
  });

  it("keeps a job that failed every attempt, with its error, for review", async () => {
    const queue = newQueue(10, 3);
    const failures: boolean[] = [];
    startWorker(queue, [], { onFailed: (f) => failures.push(f.willRetry) });

    const id = await queue.add("flaky", { failTimes: 99 });
    await until(async () => (await queue.raw.getJobState(id)) === "failed");

    const job = await queue.raw.getJob(id);
    expect(job!.attemptsMade).toBe(3);
    expect(job!.failedReason).toBe("attempt 3 failed");
    expect(failures).toEqual([true, true, false]);
  });

  it("fails an unknown job name at once instead of retrying it", async () => {
    const queue = newQueue();
    startWorker(queue, []);

    const job = await queue.raw.add("no-such-job", {});
    await until(async () => (await queue.raw.getJobState(job.id!)) === "failed");
    expect((await queue.raw.getJob(job.id!))!.attemptsMade).toBe(1);
  });

  it("finishes the job it is running when closed, and leaves the rest waiting", async () => {
    const queue = newQueue();
    const log: string[] = [];
    const worker = createTypedWorker<TestJobs>(
      queue.name,
      {
        greet: async () => {},
        flaky: async () => {},
        slow: async ({ ms }) => {
          await sleep(ms);
          log.push(`slept ${ms}`);
        },
      },
      workerConn,
      { concurrency: 1 },
    );

    await queue.add("slow", { ms: 300 });
    await queue.add("slow", { ms: 1 });
    await until(async () => (await queue.raw.getActiveCount()) === 1);

    await worker.close();

    expect(log).toEqual(["slept 300"]);
    expect(await queue.pendingCount()).toBe(1);
  });

  it("fails fast instead of hanging when Redis is unreachable", async () => {
    const deadConn = createProducerConnection("redis://127.0.0.1:1/0", { retryStrategy: () => null, lazyConnect: true });
    const queue = new TypedQueue<TestJobs>("never", deadConn);
    deadConn.on("error", () => {});

    const started = Date.now();
    await expect(queue.add("greet", { name: "x" }, {}, 1_500)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_500);
    deadConn.disconnect();
  });
});
