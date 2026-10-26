// ═══════════════════════════════════════════════════════════════
// RATE-LIMIT COUNTERS IN REDIS
//
// express-rate-limit keeps its counters in the server's memory by default. With several
// servers each has its own (three servers, three times the attempts), and every restart or
// deploy sets them back to zero. This store keeps them in Redis, where every server counts
// together and a restart changes nothing.
//
// One atomic script per request: INCR the counter, and when it is new, make it expire at
// the end of the window. Two servers counting at the same instant can't both see "9".
// The counter deletes itself when its window ends, so nothing needs cleaning up.
//
// If Redis can't be reached, the server counts in its own memory (the old behaviour) until
// Redis answers again, and says so in the log (at most once a minute).
// ═══════════════════════════════════════════════════════════════

// The one Redis command used (ioredis's `eval` has this shape).
export interface RateLimitRedis {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

// What express-rate-limit expects from a store (its own types aren't needed here).
interface RateLimitInfo {
  totalHits: number;
  resetTime: Date | undefined;
}

export interface RedisRateLimitStoreOptions {
  redis: RateLimitRedis;
  // Keeps each limiter's counters apart, e.g. "rl:platform:auth:".
  prefix: string;
  // Called when Redis fails and memory takes over (throttled to once a minute).
  onRedisError?: (err: unknown) => void;
}

const INCREMENT = `
local hits = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { hits, ttl }`;

// Only an existing counter goes down: a new one would have no expiry.
const DECREMENT = `
if redis.call("EXISTS", KEYS[1]) == 1 then
  return redis.call("DECR", KEYS[1])
end
return 0`;

const RESET = `return redis.call("DEL", KEYS[1])`;

const WARN_EVERY_MS = 60_000;

export class RedisRateLimitStore {
  // Counters are shared between servers (tells express-rate-limit not to assume otherwise).
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;
  private readonly redis: RateLimitRedis;
  private readonly onRedisError?: (err: unknown) => void;
  private lastWarning = 0;
  private lastSweep = 0;
  // The fallback: this server's own counters, used only while Redis is unreachable.
  private readonly memory = new Map<string, { hits: number; resetAt: number }>();

  constructor({ redis, prefix, onRedisError }: RedisRateLimitStoreOptions) {
    this.redis = redis;
    this.prefix = prefix;
    this.onRedisError = onRedisError;
  }

  // Called by express-rate-limit with the limiter's options.
  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    try {
      const [hits, ttl] = (await this.redis.eval(INCREMENT, 1, this.prefix + key, this.windowMs)) as [number, number];
      return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
    } catch (err) {
      this.warn(err);
      return this.incrementInMemory(key);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.redis.eval(DECREMENT, 1, this.prefix + key);
    } catch (err) {
      this.warn(err);
      const entry = this.memory.get(key);
      if (entry && entry.hits > 0) entry.hits -= 1;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      await this.redis.eval(RESET, 1, this.prefix + key);
    } catch (err) {
      this.warn(err);
    }
  }

  private incrementInMemory(key: string): RateLimitInfo {
    const now = Date.now();
    // Drop finished windows (once per window) so the map can't grow while Redis is down.
    if (now - this.lastSweep >= this.windowMs) {
      for (const [k, entry] of this.memory) if (entry.resetAt <= now) this.memory.delete(k);
      this.lastSweep = now;
    }

    const current = this.memory.get(key);
    const entry = current && current.resetAt > now ? current : { hits: 0, resetAt: now + this.windowMs };
    entry.hits += 1;
    this.memory.set(key, entry);
    return { totalHits: entry.hits, resetTime: new Date(entry.resetAt) };
  }

  private warn(err: unknown): void {
    const now = Date.now();
    if (now - this.lastWarning < WARN_EVERY_MS) return;
    this.lastWarning = now;
    this.onRedisError?.(err);
  }
}
