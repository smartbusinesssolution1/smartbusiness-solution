interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Ultra-fast in-memory LRU-like TTL cache for session claims and middleware authorizations.
 * Zero external dependencies, O(1) read/write latency (<0.01ms).
 */
export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(defaultTtlSeconds = 60, maxSize = 2000) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
