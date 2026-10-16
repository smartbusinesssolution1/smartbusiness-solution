import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { decideSeed } from "./seed-guard.js";

// R-12: the seed erases every table, so it may only run where that is clearly intended.
// Pure decision logic: no database is touched by these tests.

const LOCAL = "postgresql://dev:dev@localhost:5432/smartbusiness_dev";
// A made-up host in Neon's format (never a real one: this file is public).
const NEON = "postgresql://user:secret@ep-example-host-000000-pooler.c-0.us-east-2.aws.neon.tech/neondb?sslmode=require";
const NEON_HOST = "ep-example-host-000000-pooler.c-0.us-east-2.aws.neon.tech";

describe("decideSeed", () => {
  test("allows a local database without confirmation", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const decision = decideSeed(`postgresql://u:p@${host}:5432/smartbusiness_dev`, {});
      assert.equal(decision.allowed, true, host);
    }
  });

  test("names the database it is about to erase", () => {
    const decision = decideSeed(LOCAL, {});
    assert.ok(decision.allowed);
    assert.deepEqual(decision.target, { host: "localhost", database: "smartbusiness_dev" });
  });

  test("refuses a remote database without confirmation, and says how to confirm", () => {
    const decision = decideSeed(NEON, {});
    assert.equal(decision.allowed, false);
    assert.match(decision.message, /neondb/);
    assert.match(decision.message, new RegExp(`SEED_CONFIRM=${NEON_HOST.replace(/\./g, "\\.")}`));
  });

  test("never shows the password", () => {
    const decision = decideSeed(NEON, {});
    assert.equal(decision.allowed, false);
    assert.doesNotMatch(decision.message, /secret/);
  });

  test("refuses a remote database when the confirmation names another host", () => {
    const decision = decideSeed(NEON, { SEED_CONFIRM: "ep-other-host.neon.tech" });
    assert.equal(decision.allowed, false);
    assert.match(decision.message, /does not match/);
  });

  test("refuses a vague confirmation such as yes", () => {
    assert.equal(decideSeed(NEON, { SEED_CONFIRM: "yes" }).allowed, false);
  });

  test("allows a remote database when the confirmation is exactly its host", () => {
    const decision = decideSeed(NEON, { SEED_CONFIRM: NEON_HOST });
    assert.equal(decision.allowed, true);
  });

  test("refuses production, even for a local database and even when confirmed", () => {
    assert.equal(decideSeed(LOCAL, { NODE_ENV: "production" }).allowed, false);
    const decision = decideSeed(NEON, { NODE_ENV: "production", SEED_CONFIRM: NEON_HOST });
    assert.equal(decision.allowed, false);
    assert.match(decision.message, /production/);
  });

  test("refuses when DATABASE_URL is missing or not a URL", () => {
    assert.equal(decideSeed(undefined, {}).allowed, false);
    assert.equal(decideSeed("not a url", {}).allowed, false);
  });

  test("a local-looking name on a remote host is still remote", () => {
    assert.equal(decideSeed("postgresql://u:p@localhost.attacker.example/db", {}).allowed, false);
  });
});
