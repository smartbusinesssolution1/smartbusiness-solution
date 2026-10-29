// Test-only secrets and environment configuration
export const TEST_JWT_SECRET = "test-jwt-access-token-secret-must-be-32-chars-long";
export const TEST_DATABASE_URL = "postgresql://test:test@127.0.0.1:54329/clock_in_test";

export function applyTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.ORIGIN = "http://localhost:5173,http://localhost:5174";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? TEST_DATABASE_URL;
  process.env.RATE_LIMIT_WINDOWMS = "60000";
  process.env.RATE_LIMIT_MAX = "100000";
  process.env.JWT_ACCESS_TOKEN_SECRET = TEST_JWT_SECRET;
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = "15m";
  process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";
  process.env.FACE_RECOGNITION_API_URL = process.env.TEST_FACE_RECOGNITION_API_URL ?? "http://127.0.0.1:8000";
}
