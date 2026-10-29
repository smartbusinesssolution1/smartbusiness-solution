import { redisClient } from "./redis.service.js";
import { logger } from "./logger.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Two-Tier Cache for ClockInClockOut backend:
 * - L1: Fast In-Memory RAM Cache (0.01ms microsecond response)
 * - L2: Distributed Redis Cluster Cache (shared across containers, resilient to restarts)
 *
 * If Redis is temporarily unreachable, all operations gracefully fallback to L1 Memory.
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlSeconds: number;
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(defaultTtlSeconds = 60, maxSize = 5000) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxSize = maxSize;
  }

  /**
   * Fast L1 synchronous retrieval from in-memory cache.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Asynchronous retrieval checking L1 Memory first, then Redis L2.
   */
  async getAsync<T>(key: string): Promise<T | undefined> {
    const local = this.get<T>(key);
    if (local !== undefined) {
      return local;
    }

    try {
      const raw = await redisClient.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        this.setL1(key, parsed);
        return parsed;
      }
    } catch (err: any) {
      logger.debug({ key, err: err.message }, "Redis getAsync cache miss/error, continuing");
    }

    return undefined;
  }

  /**
   * Internal helper to write to L1 RAM only.
   */
  private setL1<T>(key: string, value: T, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Stores a value in L1 memory immediately and writes to Redis L2 with TTL.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    this.setL1(key, value, ttlSeconds);

    const ttlSec = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtlSeconds;
    try {
      const serialized = JSON.stringify(value);
      redisClient.set(key, serialized, "EX", ttlSec).catch((err) => {
        logger.debug({ key, err: err.message }, "Redis background set error");
      });
    } catch {
      // Non-serializable payload stays in L1 memory only
    }
  }

  /**
   * Deletes a specific key from both L1 and Redis L2.
   */
  delete(key: string): boolean {
    const localDeleted = this.cache.delete(key);
    redisClient.del(key).catch(() => {});
    return localDeleted;
  }

  /**
   * Alias for delete (matches Redis del command convention)
   */
  del(key: string): boolean {
    return this.delete(key);
  }

  /**
   * Invalidates all keys that start with the given prefix or pattern in L1 RAM
   * and dispatches a non-blocking Redis SCAN + UNLINK in the background.
   */
  invalidatePattern(prefixOrPattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefixOrPattern) || key.includes(prefixOrPattern)) {
        this.cache.delete(key);
        count++;
      }
    }

    // Non-blocking distributed invalidation in Redis using SCAN stream
    try {
      const matchPattern = prefixOrPattern.includes("*") ? prefixOrPattern : `*${prefixOrPattern}*`;
      const stream = redisClient.scanStream({ match: matchPattern, count: 100 });
      stream.on("data", (keys: string[]) => {
        if (keys && keys.length > 0) {
          redisClient.unlink(...keys).catch(() => {});
        }
      });
      stream.on("error", (err) => {
        logger.debug({ pattern: prefixOrPattern, err: err.message }, "Redis scanStream pattern invalidation warning");
      });
    } catch (err: any) {
      logger.debug({ err: err.message }, "Redis pattern invalidation skipped");
    }

    return count;
  }

  /**
   * Alias for invalidatePattern (matches Redis delPattern convention)
   */
  delPattern(prefixOrPattern: string): number {
    return this.invalidatePattern(prefixOrPattern);
  }

  /**
   * Helper to retrieve from L1 / L2 or fetch and store if absent.
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.getAsync<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Clear all items in local cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of stored items in L1.
   */
  size(): number {
    return this.cache.size;
  }
}

// Global shared singleton for the backend process
export const memoryCache = new CacheService(60, 5000);
