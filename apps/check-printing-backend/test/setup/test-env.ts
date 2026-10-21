import * as os from "os";
import * as path from "path";

// The disposable database from docker-compose.test.yml (`pnpm test:db:up`).
const DEFAULT_TEST_DATABASE_URL = "postgresql://test:test@127.0.0.1:54329/check_printing_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * The test database URL. The suite truncates every table, so this refuses any URL
 * that could be a real database: the database name must contain "test", and the
 * host must be local unless TEST_DATABASE_ALLOW_REMOTE=true (CI service containers).
 */
export function testDatabaseUrl(): string {
  const raw = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const url = new URL(raw);
  const dbName = url.pathname.replace(/^\//, "");

  if (!dbName.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": its name must contain "test". ` +
        "The test suite deletes all data in the database it uses.",
    );
  }
  if (!LOCAL_HOSTS.has(url.hostname) && process.env.TEST_DATABASE_ALLOW_REMOTE !== "true") {
    throw new Error(
      `Refusing to run tests against non-local host "${url.hostname}". ` +
        "Set TEST_DATABASE_ALLOW_REMOTE=true only for a disposable CI database.",
    );
  }
  return raw;
}

/** Where printed test PDFs go: a temp directory, never the real uploads folder. */
export const TEST_STORAGE_PATH = path.join(os.tmpdir(), "check-printing-tests");

// Test-only secrets. They protect nothing and must never be used outside tests.
export const TEST_JWT_SECRET = "test-only-jwt-secret-0123456789abcdef0123456789";
export const TEST_ENCRYPTION_KEY = "0f".repeat(32);
export const TEST_STORAGE_KEY = "0e".repeat(32);

// The S3 imitation from docker-compose.test.yml (Adobe S3Mock), with its test bucket.
export const TEST_S3 = {
  endpoint: process.env.TEST_S3_ENDPOINT ?? "http://127.0.0.1:59090",
  bucket: "check-printing-test",
  region: "us-east-1",
};

/** Sets the environment before any application module reads its config. */
export function applyTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  process.env.PDF_STORAGE_PATH = TEST_STORAGE_PATH;
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_ENCRYPTION_KEY = TEST_STORAGE_KEY;
  process.env.STORAGE_ENCRYPTION_KEY_ID = "test1";
  // The S3 driver tests talk to S3Mock, which accepts any credentials.
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  process.env.E13B_FONT_PATH = process.env.TEST_E13B_FONT_PATH ?? "./micr/MICR.ttf";
  // The development font is a trial with defective glyphs; tests check layout, not the font.
  process.env.E13B_FONT_STRICT = "false";
  process.env.RATE_LIMIT_MAX = "1000000";
  // Two frontends, as on the platform (the check-printing app and the customer portal).
  process.env.CORS_ORIGIN = "http://localhost:5173, http://localhost:5174";
  // The test Redis (docker-compose.test.yml), database 2: platform-api's tests use 1.
  // Nothing processes this queue in these tests; they read the jobs that were added.
  process.env.REDIS_URL = process.env.CHECK_TEST_REDIS_URL ?? "redis://127.0.0.1:63790/2";
}
