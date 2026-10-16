import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// R-12, end to end: runs the real seed script as a separate process.
//
// Safety: the target is the disposable test database from
// apps/check-printing-backend/docker-compose.test.yml (pnpm test:db:up). This file refuses any
// other database, and the seed process is started with DOTENV_CONFIG_PATH pointing at a file
// that does not exist, so packages/database/.env (the shared Neon database) is never loaded.

const TEST_URL = process.env.SEED_TEST_DATABASE_URL ?? "postgresql://test:test@127.0.0.1:54329/check_printing_test";
{
  const url = new URL(TEST_URL);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("test")) {
    throw new Error(`Refusing to run seed tests against ${url.hostname}${url.pathname}: local *test* databases only.`);
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");
const tsx = path.join(packageDir, "node_modules", ".bin", "tsx");

function runSeed(env: Record<string, string>) {
  const result = spawnSync(tsx, ["prisma/seed.ts"], {
    cwd: packageDir,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      DOTENV_CONFIG_PATH: path.join(packageDir, "does-not-exist.env"),
      ENCRYPTION_KEY: "0f".repeat(32),
      NODE_ENV: "development",
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("running the seed script", () => {
  let db: pg.Pool;
  const count = async (table: string) =>
    Number((await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n);

  beforeEach(async () => {
    db = new pg.Pool({ connectionString: TEST_URL, max: 2 });
    const { rows } = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    await db.query(`TRUNCATE TABLE ${rows.map((r) => `"public"."${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  });

  afterEach(async () => {
    await db.end();
  });

  test("refuses a remote database without confirmation, before connecting to it", () => {
    // .invalid never resolves (RFC 2606): without the guard the seed would fail on DNS instead.
    const { status, output } = runSeed({ DATABASE_URL: "postgresql://u:p@db.prod.invalid:5432/production" });

    assert.notEqual(status, 0);
    assert.match(output, /Refusing/);
    assert.match(output, /db\.prod\.invalid/);
    assert.doesNotMatch(output, /ENOTFOUND|getaddrinfo|ECONNREFUSED/);
  });

  test("refuses in production and leaves the data alone", async () => {
    await db.query(`INSERT INTO tenants (id, name, billing_email, updated_at) VALUES (gen_random_uuid(), 'Keep Me', 'keep@example.test', now())`);

    const { status, output } = runSeed({ DATABASE_URL: TEST_URL, NODE_ENV: "production" });

    assert.notEqual(status, 0);
    assert.match(output, /production/);
    assert.equal(await count("tenants"), 1);
  });

  test("re-seeds a local database even when password-reset links and idempotency records exist", async () => {
    const first = runSeed({ DATABASE_URL: TEST_URL });
    assert.equal(first.status, 0, first.output);

    // Leftovers a real development database has: a forgot-password link and an idempotency record.
    const { rows } = await db.query("SELECT id FROM users LIMIT 1");
    await db.query(
      `INSERT INTO user_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (gen_random_uuid(), $1, 'PASSWORD_RESET', repeat('a', 64), now() + interval '1 hour')`,
      [rows[0].id],
    );
    await db.query(
      `INSERT INTO idempotency_records (id, key, user_id, method, path, status_code, response_body, expires_at) VALUES (gen_random_uuid(), 'k1', $1, 'POST', '/x', 201, '{}', now() + interval '1 day')`,
      [rows[0].id],
    );

    const second = runSeed({ DATABASE_URL: TEST_URL });

    const state = { users: await count("users"), checks: await count("checks"), tokens: await count("user_tokens") };
    assert.equal(second.status, 0, `second seed failed (state after: ${JSON.stringify(state)}):\n${second.output.slice(-800)}`);
    assert.equal(state.users, 6);
    assert.ok(state.checks > 0);
    assert.equal(state.tokens, 0);
    assert.equal(await count("idempotency_records"), 0);
    // Every demo bank account carries its fingerprint, so the API refuses duplicates of it (R-08).
    const fingerprinted = await db.query("SELECT count(*)::int AS n FROM bank_accounts WHERE account_fingerprint IS NOT NULL");
    assert.equal(fingerprinted.rows[0].n, await count("bank_accounts"));
    assert.ok((await count("bank_accounts")) > 0);
  });
});
