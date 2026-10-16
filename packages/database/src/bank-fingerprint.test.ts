import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bankAccountFingerprint } from "./bank-fingerprint.js";

// R-08: a fingerprint ("blind index") of routing + account number lets the database refuse
// the same real account twice although the numbers themselves are stored encrypted.

const KEY = "0f".repeat(32);
const OTHER_KEY = "0e".repeat(32);

describe("bankAccountFingerprint", () => {
  test("is the same for the same account, every time", () => {
    const a = bankAccountFingerprint(KEY, "026009593", "123456785678");
    const b = bankAccountFingerprint(KEY, "026009593", "123456785678");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  test("differs for a different account number or a different bank", () => {
    const base = bankAccountFingerprint(KEY, "026009593", "123456785678");
    assert.notEqual(bankAccountFingerprint(KEY, "026009593", "123456785679"), base);
    assert.notEqual(bankAccountFingerprint(KEY, "111000025", "123456785678"), base);
  });

  test("treats leading zeros as part of the account number (they are printed on the MICR line)", () => {
    assert.notEqual(bankAccountFingerprint(KEY, "026009593", "00123"), bankAccountFingerprint(KEY, "026009593", "123"));
  });

  test("cannot be confused across the routing/account boundary", () => {
    assert.notEqual(bankAccountFingerprint(KEY, "026009593", "1234"), bankAccountFingerprint(KEY, "0260095931", "234"));
  });

  test("depends on the secret key, so a stolen database cannot be matched by guessing", () => {
    assert.notEqual(bankAccountFingerprint(KEY, "026009593", "123456785678"), bankAccountFingerprint(OTHER_KEY, "026009593", "123456785678"));
  });

  test("is not a plain SHA-256 of the numbers (that could be brute-forced offline)", () => {
    const fingerprint = bankAccountFingerprint(KEY, "026009593", "123456785678");
    for (const guess of ["026009593:123456785678", "026009593123456785678", "123456785678"]) {
      assert.notEqual(fingerprint, createHash("sha256").update(guess).digest("hex"));
    }
  });

  test("refuses input that is not digits, or a key that is not 64 hex characters", () => {
    assert.throws(() => bankAccountFingerprint(KEY, "02600959X", "123"));
    assert.throws(() => bankAccountFingerprint(KEY, "026009593", ""));
    assert.throws(() => bankAccountFingerprint("not-hex", "026009593", "123"));
  });
});
