import { describe, expect, it } from "vitest";
import { envSchema } from "./env.schema.js";

// CORS_ORIGIN lists the frontends allowed to call this API from a browser (R-14). With
// cookies involved, a wrong entry would let another site act as the logged-in user, so a
// value that is not an exact origin stops the server at startup.

const REQUIRED = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: "0f".repeat(32),
  STORAGE_ENCRYPTION_KEY: "0e".repeat(32),
};

const PRODUCTION = {
  ...REQUIRED,
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/app?sslmode=verify-full",
  STORAGE_DRIVER: "s3",
  S3_BUCKET: "checks",
  APP_URL: "https://checks.example.com",
  REDIS_URL: "rediss://cache.example.com:6379",
};

const parseOrigins = (value: string | undefined) => envSchema.safeParse({ ...REQUIRED, CORS_ORIGIN: value });

// S2: a server started without NODE_ENV used to run as "development" without a word.
// Development has to be asked for: no value, no start.
describe("NODE_ENV", () => {
  const parseEnv = (value: string | undefined) => envSchema.safeParse({ ...REQUIRED, NODE_ENV: value });

  it("is required: a missing value stops the server with a message saying so", () => {
    const result = parseEnv(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/NODE_ENV is required/);
  });

  it.each(["development", "test", "staging"])("accepts %s", (value) => {
    expect(parseEnv(value).success).toBe(true);
  });

  it("accepts production (which also needs S3, APP_URL, REDIS_URL and a verify-full database URL)", () => {
    expect(envSchema.safeParse(PRODUCTION).success).toBe(true);
  });

  it.each(["", "prod", "Production", "dev"])("refuses %j", (value) => {
    expect(parseEnv(value).success).toBe(false);
  });
});

// S9: production reaches the database over TLS with the certificate checked, said outright
// (the driver's next major version weakens "require" to "encrypt, don't verify").
describe("DATABASE_URL in production", () => {
  const withDatabase = (url: string, NODE_ENV = "production") => envSchema.safeParse({ ...PRODUCTION, NODE_ENV, DATABASE_URL: url });

  it.each([
    ["postgresql://u:p@db.example.com/app", "no sslmode"],
    ["postgresql://u:p@db.example.com/app?sslmode=require", "require"],
    ["postgresql://u:p@db.example.com/app?sslmode=prefer", "prefer"],
    ["postgresql://u:p@db.example.com/app?sslmode=disable", "disable"],
  ])("refuses %s (%s)", (url) => {
    const result = withDatabase(url);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(" ")).toMatch(/sslmode=verify-full/);
  });

  it("accepts sslmode=verify-full", () => {
    expect(withDatabase("postgresql://u:p@db.example.com/app?sslmode=verify-full").success).toBe(true);
  });

  it("leaves development alone (a local database has no TLS)", () => {
    expect(withDatabase("postgresql://u:p@localhost:5432/app", "development").success).toBe(true);
  });
});

// R-10: ENCRYPTION_KEY decrypts every stored bank account number. Only exactly 64 hex characters
// make a valid AES-256 key; anything else used to pass startup and fail on the first bank operation.
describe("ENCRYPTION_KEY", () => {
  const parseKey = (key: string) => envSchema.safeParse({ ...REQUIRED, ENCRYPTION_KEY: key });

  it("accepts exactly 64 hex characters", () => {
    expect(parseKey("ab".repeat(32)).success).toBe(true);
  });

  it.each([
    ["g".repeat(64), "64 characters, not hex"],
    ["0f".repeat(33), "66 hex characters"],
    ["0f".repeat(31), "62 hex characters"],
    [`${"0f".repeat(31)}0 `, "trailing space"],
  ])("refuses %j (%s)", (key) => {
    expect(parseKey(key).success).toBe(false);
  });
});

describe("CORS_ORIGIN", () => {
  it("defaults to the local web app", () => {
    const result = parseOrigins(undefined);
    expect(result.success && result.data.CORS_ORIGIN).toEqual(["http://localhost:5173"]);
  });

  it("accepts one origin, as before", () => {
    const result = parseOrigins("https://checks.smartbusiness.com");
    expect(result.success && result.data.CORS_ORIGIN).toEqual(["https://checks.smartbusiness.com"]);
  });

  it("accepts several origins separated by commas, ignoring spaces and a trailing slash", () => {
    const result = parseOrigins(" https://checks.smartbusiness.com , https://portal.smartbusiness.com/ ");
    expect(result.success && result.data.CORS_ORIGIN).toEqual([
      "https://checks.smartbusiness.com",
      "https://portal.smartbusiness.com",
    ]);
  });

  it.each([
    ["*", "everyone"],
    ["localhost:5173", "no scheme"],
    ["ftp://files.example.com", "not http(s)"],
    ["https://app.example.com/login", "a path, not an origin"],
    ["https://app.example.com?x=1", "a query string"],
    ["", "empty"],
    [" , ", "only separators"],
  ])("refuses %j (%s)", (value) => {
    const result = parseOrigins(value);
    expect(result.success).toBe(false);
  });
});
