import { Queue, type JobsOptions } from "bullmq";
import type { Redis } from "ioredis";

export interface RetryPolicy {
  // Total tries, including the first one
  attempts: number;
  // Wait before the first retry; each later retry waits twice as long
  backoffMs: number;
}

// 5 tries: waits of 10 s, 20 s, 40 s, 80 s (about 2.5 minutes), enough to ride out a
// short provider outage without hammering it.
export const DEFAULT_RETRY: RetryPolicy = { attempts: 5, backoffMs: 10_000 };

export function defaultJobOptions(retry: RetryPolicy): JobsOptions {
  return {
    attempts: retry.attempts,
    backoff: { type: "exponential", delay: retry.backoffMs },
    // Finished jobs are useful for a while (debugging, dashboards), then cleaned up.
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    // Failed jobs are kept a week so someone can see why and retry them.
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  };
}

// A queue that only accepts the job names and data shapes declared for it.
// `Jobs` maps each job name to its data, e.g. EmailJobs.
export class TypedQueue<Jobs extends object> {
  readonly raw: Queue;

  constructor(
    readonly name: string,
    connection: Redis,
    retry: RetryPolicy = DEFAULT_RETRY,
  ) {
    this.raw = new Queue(name, { connection, defaultJobOptions: defaultJobOptions(retry) });
  }

  // Adds a job, refusing to wait longer than `timeoutMs` for Redis, so a request that
  // adds a job can answer quickly even when Redis is down.
  async add<K extends keyof Jobs & string>(
    jobName: K,
    data: Jobs[K],
    options: JobsOptions = {},
    timeoutMs = 3_000,
  ): Promise<string> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Adding job "${jobName}" timed out after ${timeoutMs} ms`)), timeoutMs);
    });
    try {
      const job = await Promise.race([this.raw.add(jobName, data, options), timeout]);
      return job.id!;
    } finally {
      clearTimeout(timer);
    }
  }

  // Jobs not finished yet: waiting, running, or waiting for a retry.
  async pendingCount(): Promise<number> {
    const counts = await this.raw.getJobCounts("waiting", "active", "delayed", "prioritized", "waiting-children");
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }

  async close(): Promise<void> {
    await this.raw.close();
  }
}
