import { createProducerConnection, QUEUES, TypedQueue, type EmailJobs, type Redis } from "@smartbusiness/jobs";
import { jobs } from "../config/index.js";
import { logger } from "../shared/services/logger.js";

// This service only ADDS jobs; platform-api's worker sends the emails. The producer
// connection fails fast when Redis is down, so a request can answer instead of hanging.
export const producerConnection: Redis = createProducerConnection(jobs.redisUrl);
producerConnection.on("error", (err) => logger.warn({ err: err.message }, "Redis (producer) connection problem"));

export const emailQueue = new TypedQueue<EmailJobs>(QUEUES.emails, producerConnection, jobs.retry);

export async function closeQueues(): Promise<void> {
  await emailQueue.close();
  await producerConnection.quit().catch(() => producerConnection.disconnect());
}
