import { createHmac, hkdfSync } from "crypto";

// ═══════════════════════════════════════════════════════════════
// BANK ACCOUNT FINGERPRINT (a "blind index")
//
// Account numbers are stored encrypted with a random IV, so the same number never
// encrypts the same way and the database cannot tell two records of one real account
// apart. Two such records keep separate check counters, and two different checks end up
// with the same number at the bank.
//
// The fingerprint is stored next to the ciphertext: the same routing + account number
// always gives the same value (so a unique index can refuse duplicates), and the value
// cannot be turned back into the numbers.
//
// It is an HMAC, not a plain hash: routing numbers are public and account numbers short,
// so plain SHA-256 values could be matched by trying every combination offline. Without
// the key that is useless.
//
// The key is derived from ENCRYPTION_KEY with HKDF under its own label (a separate key
// for a separate purpose, no new secret to manage). Anyone holding ENCRYPTION_KEY can
// already decrypt the numbers, so this exposes nothing new. If ENCRYPTION_KEY ever
// changes, every fingerprint must be recomputed.
//
// Shared by the API, the seed and the backfill script, so all compute it the same way.
// ═══════════════════════════════════════════════════════════════

const KEY_LABEL = "smartbusiness/bank-account-fingerprint/v1";
const HEX_KEY = /^[0-9a-fA-F]{64}$/;
const DIGITS = /^\d+$/;

export function bankAccountFingerprint(encryptionKeyHex: string, routingNumber: string, accountNumber: string): string {
  if (!HEX_KEY.test(encryptionKeyHex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters to compute bank account fingerprints");
  }
  if (!DIGITS.test(routingNumber) || !DIGITS.test(accountNumber)) {
    throw new Error("Routing and account numbers must be digits only");
  }

  const key = Buffer.from(
    hkdfSync("sha256", Buffer.from(encryptionKeyHex, "hex"), Buffer.alloc(0), KEY_LABEL, 32),
  );
  // ":" cannot occur in either number, so "0260095931" + "234" never collides with
  // "026009593" + "1234". Digits are used exactly as entered: leading zeros are printed
  // on the MICR line, so they are part of the account number.
  return createHmac("sha256", key).update(`${routingNumber}:${accountNumber}`).digest("hex");
}
