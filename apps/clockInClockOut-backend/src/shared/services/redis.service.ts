import { createProducerConnection, QUEUES, TypedQueue, type EmailJobs, type Redis } from "@smartbusiness/jobs";
import { env } from "../../config/index.js";
import { logger } from "./logger.js";

/**
 * Shared fail-fast Redis connection for ClockInClockOut backend.
 * Uses @smartbusiness/jobs producer connection settings:
 * - maxRetriesPerRequest: 1 (fails fast instead of hanging HTTP requests)
 * - enableOfflineQueue: false (prevents memory leaks when Redis is down)
 * - connectTimeout: 3000ms
 */
export const redisClient: Redis = createProducerConnection(env.redis.url);

let isRedisConnected = false;
let lastErrorLogTime = 0;

redisClient.on("connect", () => {
  isRedisConnected = true;
  logger.info({ url: env.redis.url }, "Redis producer connection established");
});

redisClient.on("ready", () => {
  isRedisConnected = true;
  logger.info("Redis client ready to accept commands");
});

redisClient.on("error", (err: Error) => {
  isRedisConnected = false;
  const now = Date.now();
  // Throttle warning log to once every 30 seconds when Redis is unavailable
  if (now - lastErrorLogTime > 30000) {
    logger.warn({ err: err.message }, "Redis connection unavailable (operating in memory fallback mode)");
    lastErrorLogTime = now;
  }
});

redisClient.on("close", () => {
  isRedisConnected = false;
});

/**
 * BullMQ email queue shared across monorepo services.
 * Adds jobs to 'emails' queue processed asynchronously by platform-api worker.
 */
export const emailQueue = new TypedQueue<EmailJobs>(QUEUES.emails, redisClient);

// Prevent unhandled BullMQ error events when Redis is offline (already handled via redisClient)
emailQueue.raw.on("error", () => {});

/**
 * Check if Redis is currently responsive
 */
export function isRedisAvailable(): boolean {
  return isRedisConnected && redisClient.status === "ready";
}

/**
 * Gracefully close Redis connection on server shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    await emailQueue.close().catch(() => {});
    await redisClient.quit();
    logger.info("Redis client disconnected gracefully");
  } catch {
    redisClient.disconnect();
    logger.info("Redis client disconnected forcefully");
  }
}
