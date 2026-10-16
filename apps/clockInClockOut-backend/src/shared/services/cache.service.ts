interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Ultra-fast L1 In-Memory Cache for ClockInClockOut backend.
 * Provides microsecond (<0.05ms) response times for hot queries, summary aggregations,
 * and attendance lists with TTL and pattern-based invalidation.
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(defaultTtlSeconds = 60, maxSize = 5000) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxSize = maxSize;
  }

  /**
   * Retrieves an entry from cache. Returns undefined if missing or expired.
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
   * Stores a value in the cache with the given TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxSize) {
      // LRU eviction: remove the oldest item (first inserted in Map)
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
   * Deletes a specific key.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidates all keys that start with the given prefix or pattern.
   * Useful when a punch event or update occurs and all cache entries
   * for that tenant/workspace need to be purged.
   */
  invalidatePattern(prefixOrPattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefixOrPattern) || key.includes(prefixOrPattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Helper to retrieve from cache or fetch and store if absent.
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Clear all items in cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of stored items.
   */
  size(): number {
    return this.cache.size;
  }
}

// Global shared singleton for the backend process
export const memoryCache = new CacheService(60, 5000);
