import { UnrecoverableError, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";

// One function per job name. TypeScript checks every declared job has a processor
// and that each processor receives the right data shape.
export type Processors<Jobs extends object> = {
  [K in keyof Jobs]: (data: Jobs[K], job: Job) => Promise<unknown>;
};

export interface WorkerHooks {
  // Called when an attempt fails; `willRetry` is false on the last attempt.
  onFailed?: (info: { queue: string; jobName: string; jobId?: string; attempt: number; willRetry: boolean; error: Error }) => void;
  onCompleted?: (info: { queue: string; jobName: string; jobId?: string }) => void;
}

// Starts a worker that pulls jobs from `queueName` and runs the matching processor.
// Close it with `await worker.close()`: it finishes the jobs it is running, takes no
// new ones, and leaves everything else waiting in Redis for the next worker.
export function createTypedWorker<Jobs extends object>(
  queueName: string,
  processors: Processors<Jobs>,
  connection: Redis,
  options: { concurrency?: number; autorun?: boolean } & WorkerHooks = {},
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const processor = (processors as Record<string, ((data: unknown, job: Job) => Promise<unknown>) | undefined>)[job.name];
      if (!processor) {
        // Retrying cannot fix an unknown job name: fail at once instead of 5 times.
        throw new UnrecoverableError(`No processor for job "${job.name}" on queue "${queueName}"`);
      }
      return processor(job.data, job);
    },
    { connection, concurrency: options.concurrency ?? 5, autorun: options.autorun ?? true },
  );

  worker.on("failed", (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    options.onFailed?.({
      queue: queueName,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade,
      willRetry: !(error instanceof UnrecoverableError) && job.attemptsMade < attempts,
      error,
    });
  });
  worker.on("completed", (job) => {
    options.onCompleted?.({ queue: queueName, jobName: job.name, jobId: job.id });
  });
  // Connection problems are reported, not thrown: the worker reconnects by itself.
  worker.on("error", () => {});

  return worker;
}
