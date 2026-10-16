import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { bankAccountFingerprint } from "../src/bank-fingerprint.js";

// R-08, end to end: runs the real backfill script against the disposable test database
// (same safety as seed.e2e.test.ts: local *test* databases only; packages/database/.env is
// never loaded).

const TEST_URL = process.env.SEED_TEST_DATABASE_URL ?? "postgresql://test:test@127.0.0.1:54329/check_printing_test";
{
  const url = new URL(TEST_URL);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("test")) {
    throw new Error(`Refusing to run backfill tests against ${url.hostname}${url.pathname}: local *test* databases only.`);
  }
}
const KEY = "0f".repeat(32);

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");
const tsx = path.join(packageDir, "node_modules", ".bin", "tsx");

function runBackfill(env: Record<string, string> = {}) {
  const result = spawnSync(tsx, ["prisma/backfill-bank-fingerprints.ts"], {
    cwd: packageDir,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      DOTENV_CONFIG_PATH: path.join(packageDir, "does-not-exist.env"),
      DATABASE_URL: TEST_URL,
      ENCRYPTION_KEY: KEY,
      NODE_ENV: "development",
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

// The API's encryption format, so rows look exactly like real pre-fingerprint accounts.
function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(KEY, "hex"), iv);
  const body = cipher.update(plain, "utf8", "hex") + cipher.final("hex");
  return `${iv.toString("hex")}:${body}:${cipher.getAuthTag().toString("hex")}`;
}

describe("backfilling bank account fingerprints", () => {
  let db: pg.Pool;

  const tenant = async () => {
    const id = randomUUID();
    await db.query(`INSERT INTO tenants (id, name, billing_email, updated_at) VALUES ($1, 'Co', $2, now())`, [id, `${id}@example.test`]);
    return id;
  };
  const workspace = async (tenantId: string, name: string) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO workspaces (id, tenant_id, business_name, address_line1, city, state, zip_code, updated_at)
       VALUES ($1, $2, $3, '1 Main St', 'Austin', 'TX', '78701', now())`,
      [id, tenantId, name],
    );
    return id;
  };
  // A pre-R-08 account: encrypted numbers, no fingerprint.
  const legacyAccount = async (workspaceId: string, routing: string, account: string, encrypted?: { routing: string; account: string }) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO bank_accounts (id, workspace_id, bank_name, routing_number_encrypted, routing_number_last4,
         account_number_encrypted, account_number_last4, next_check_number, updated_at)
       VALUES ($1, $2, 'Test Bank', $3, $4, $5, $6, 1001, now())`,
      [id, workspaceId, encrypted?.routing ?? encrypt(routing), routing.slice(-4), encrypted?.account ?? encrypt(account), account.slice(-4)],
    );
    return id;
  };
  const fingerprintOf = async (id: string) =>
    (await db.query("SELECT account_fingerprint FROM bank_accounts WHERE id = $1", [id])).rows[0].account_fingerprint as string | null;

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

  test("fills the fingerprint of every account recorded once", async () => {
    const ws = await workspace(await tenant(), "Green Acres");
    const a = await legacyAccount(ws, "026009593", "123456785678");
    const b = await legacyAccount(ws, "111000025", "987654321012");

    const { status, output } = runBackfill();

    assert.equal(status, 0, output);
    assert.equal(await fingerprintOf(a), bankAccountFingerprint(KEY, "026009593", "123456785678"));
    assert.equal(await fingerprintOf(b), bankAccountFingerprint(KEY, "111000025", "987654321012"));
    assert.match(output, /Filled 2 fingerprint/);
  });

  test("reports the same account recorded twice in one company and leaves both alone", async () => {
    const company = await tenant();
    const ws1 = await workspace(company, "Green Acres");
    const ws2 = await workspace(company, "Green Acres Design");
    const dup1 = await legacyAccount(ws1, "026009593", "123456785678");
    const dup2 = await legacyAccount(ws2, "026009593", "123456785678");
    const single = await legacyAccount(ws1, "111000025", "987654321012");

    const { status, output } = runBackfill();

    assert.equal(status, 2, output);
    assert.equal(await fingerprintOf(dup1), null);
    assert.equal(await fingerprintOf(dup2), null);
    assert.notEqual(await fingerprintOf(single), null);
    assert.match(output, /1 real account\(s\) are recorded more than once/);
    assert.ok(output.includes(dup1) && output.includes(dup2), output);
  });

  test("the same account in two different companies is not a duplicate", async () => {
    const a = await legacyAccount(await workspace(await tenant(), "Company A"), "026009593", "123456785678");
    const b = await legacyAccount(await workspace(await tenant(), "Company B"), "026009593", "123456785678");

    const { status, output } = runBackfill();

    assert.equal(status, 0, output);
    assert.notEqual(await fingerprintOf(a), null);
    assert.notEqual(await fingerprintOf(b), null);
  });

  test("a legacy row duplicating an already-fingerprinted account is reported, not filled", async () => {
    const ws = await workspace(await tenant(), "Green Acres");
    const modern = await legacyAccount(ws, "026009593", "123456785678");
    await db.query("UPDATE bank_accounts SET account_fingerprint = $1 WHERE id = $2", [
      bankAccountFingerprint(KEY, "026009593", "123456785678"),
      modern,
    ]);
    const legacy = await legacyAccount(await workspace((await db.query("SELECT tenant_id FROM workspaces WHERE id = $1", [ws])).rows[0].tenant_id, "Other WS"), "026009593", "123456785678");

    const { status, output } = runBackfill();

    assert.equal(status, 2, output);
    assert.equal(await fingerprintOf(legacy), null);
  });

  test("an account that cannot be decrypted is reported and skipped; the others are still filled", async () => {
    const ws = await workspace(await tenant(), "Green Acres");
    const broken = await legacyAccount(ws, "026009593", "123456785678", { routing: "garbage", account: "garbage" });
    const fine = await legacyAccount(ws, "111000025", "987654321012");

    const { status, output } = runBackfill();

    assert.equal(status, 0, output);
    assert.equal(await fingerprintOf(broken), null);
    assert.notEqual(await fingerprintOf(fine), null);
    assert.match(output, /could not be decrypted/);
  });

  test("running it again changes nothing", async () => {
    const ws = await workspace(await tenant(), "Green Acres");
    const a = await legacyAccount(ws, "026009593", "123456785678");
    runBackfill();
    const before = await fingerprintOf(a);

    const { status, output } = runBackfill();

    assert.equal(status, 0, output);
    assert.equal(await fingerprintOf(a), before);
    assert.match(output, /Filled 0 fingerprint/);
  });

  test("refuses a remote database without confirmation, before connecting to it", () => {
    const { status, output } = runBackfill({ DATABASE_URL: "postgresql://u:p@db.prod.invalid:5432/production" });

    assert.equal(status, 1);
    assert.match(output, /Refusing/);
    assert.match(output, /BACKFILL_CONFIRM=db\.prod\.invalid/);
    assert.doesNotMatch(output, /ENOTFOUND|getaddrinfo/);
  });
});
