// The disposable database from apps/check-printing-backend/docker-compose.test.yml
// (`pnpm --filter @smartbusiness/check-printing-backend test:db:up`). platform-api uses
// its own database in that container, so both suites can run at the same time without
// truncating each other's tables. `prisma migrate deploy` creates it on first use.
const DEFAULT_TEST_DATABASE_URL = "postgresql://test:test@127.0.0.1:54329/platform_api_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * The test database URL. The suite deletes all data in it, so this refuses any URL
 * that could be a real database: the name must contain "test", and the host must be
 * local unless TEST_DATABASE_ALLOW_REMOTE=true (CI service containers).
 */
export function testDatabaseUrl(): string {
  const raw = process.env.PLATFORM_TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const url = new URL(raw);
  const dbName = url.pathname.replace(/^\//, "");

  if (!dbName.toLowerCase().includes("test")) {
    throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
  }
  if (!LOCAL_HOSTS.has(url.hostname) && process.env.TEST_DATABASE_ALLOW_REMOTE !== "true") {
    throw new Error(
      `Refusing to run tests against non-local host "${url.hostname}". ` +
        "Set TEST_DATABASE_ALLOW_REMOTE=true only for a disposable CI database.",
    );
  }
  return raw;
}

// Test-only secret. It protects nothing and must never be used outside tests.
export const TEST_JWT_SECRET = "test-only-jwt-secret-0123456789abcdef0123456789";

/** Sets the environment before any application module reads its config. */
export function applyTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
  process.env.REFRESH_TOKEN_EXPIRES_DAYS = "7";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  // High limits so the suite is not throttled; rate-limiter.test.ts proves the limiter itself.
  process.env.RATE_LIMIT_MAX = "1000000";
  process.env.AUTH_RATE_LIMIT_MAX = "1000000";
  process.env.MFA_RATE_LIMIT_MAX = "1000000";
  delete process.env.COOKIE_DOMAIN;
  // Emails are kept in memory; tests read them (and the links in them) from there.
  process.env.EMAIL_TRANSPORT = "memory";
  process.env.EMAIL_FROM = "SmartBusiness <no-reply@smartbusiness.test>";
  process.env.APP_URL = "https://app.smartbusiness.test";
  process.env.PASSWORD_RESET_TTL_MINUTES = "60";
  process.env.MFA_ENCRYPTION_KEY = "7a".repeat(32);
  // Job queue: the test Redis, database 1 (emptied by global setup); short retry waits.
  process.env.REDIS_URL = process.env.PLATFORM_TEST_REDIS_URL ?? "redis://127.0.0.1:63790/1";
  process.env.JOB_RETRY_BACKOFF_MS = "50";
}
