import { describe, expect, it } from "vitest";
import { envSchema } from "../../src/config/env.schema.js";
import { isLocalNetworkOrigin } from "../../src/app.js";

// S2: a server started without NODE_ENV used to run as "development" without a word:
// login cookies without Secure, stack traces sent to users, local-network origins
// allowed. Development has to be asked for: no value, no start.

const REQUIRED = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(32),
  REDIS_URL: "redis://127.0.0.1:6379",
  MFA_ENCRYPTION_KEY: "0f".repeat(32),
};

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

  it.each(["", "prod", "Production", "dev"])("refuses %j", (value) => {
    expect(parseEnv(value).success).toBe(false);
  });
});

// S9: production reaches the database over TLS with the certificate checked, said outright.
describe("DATABASE_URL in production", () => {
  const PRODUCTION = { ...REQUIRED, NODE_ENV: "production", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "email-smtp.us-east-1.amazonaws.com", SMTP_USER: "u", SMTP_PASS: "p" };
  const withDatabase = (url: string) => envSchema.safeParse({ ...PRODUCTION, DATABASE_URL: url });

  it.each(["postgresql://u:p@db.example.com/app", "postgresql://u:p@db.example.com/app?sslmode=require"])("refuses %s", (url) => {
    const result = withDatabase(url);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(" ")).toMatch(/sslmode=verify-full/);
  });

  it("accepts sslmode=verify-full", () => {
    expect(withDatabase("postgresql://u:p@db.example.com/app?sslmode=verify-full").success).toBe(true);
  });
});

// Development lets phones and other computers on the developer's network call the API.
// Only real private addresses count.
describe("local-network origins (development only)", () => {
  it.each([
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://10.0.0.7:5174",
    "http://172.16.4.2:5174",
    "http://172.31.255.1:5174",
    "http://192.168.1.20:5174",
  ])("%s is on the local network", (origin) => {
    expect(isLocalNetworkOrigin(origin)).toBe(true);
  });

  it.each([
    ["http://172.15.0.1", "172.0–172.15 is public"],
    ["http://172.32.0.1", "172.32 and up is public"],
    ["http://8.8.8.8", "public"],
    ["http://10.attacker.com", "a domain that only starts like a private address"],
    ["http://192.168.evil.com", "a domain that only starts like a private address"],
    ["http://10.0.0.999", "not an address"],
    ["not a url", "not a URL"],
  ])("%s is not (%s)", (origin) => {
    expect(isLocalNetworkOrigin(origin)).toBe(false);
  });
});
