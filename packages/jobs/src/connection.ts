import { Redis, type RedisOptions } from "ioredis";

// Two kinds of Redis connection, because producers and workers want opposite things
// when Redis is unreachable:
//
// - A WORKER waits patiently and reconnects: it has nothing to do until Redis is back.
//   BullMQ requires maxRetriesPerRequest: null for workers.
// - A PRODUCER (an API request adding a job) must fail fast, so the request can answer
//   "try again in a moment" instead of hanging until the HTTP client times out.

export function createWorkerConnection(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, ...options });
}

export function createProducerConnection(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3_000,
    ...options,
  });
}
