export { createProducerConnection, createWorkerConnection } from "./connection.js";
export { QUEUES, type QueueName, type EmailJobs } from "./jobs.js";
export { TypedQueue, DEFAULT_RETRY, defaultJobOptions, type RetryPolicy } from "./queue.js";
export { createTypedWorker, type Processors, type WorkerHooks } from "./worker.js";
export { UnrecoverableError, type Job, type Worker } from "bullmq";
export type { Redis } from "ioredis";
