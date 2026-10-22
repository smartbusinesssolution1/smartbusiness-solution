import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ═══════════════════════════════════════════════════════════════
// TOTP: TIME-BASED ONE-TIME CODES (RFC 6238), THE CODES IN AUTHENTICATOR APPS
//
// Setup shares one random secret between the server and the phone (via a QR code).
// From then on both calculate, independently and offline:
//
//   step = floor(unix time / 30)                    → changes every 30 seconds
//   mac  = HMAC-SHA1(secret, step as 8 bytes)       → 20 bytes
//   code = 31 bits picked from mac (RFC 4226) mod 1,000,000, padded to 6 digits
//
// Same secret + same clock = same code. Phones' clocks drift a little, so the previous
// and next step are accepted too (a 90-second window).
// ═══════════════════════════════════════════════════════════════

export const TOTP = {
  stepSeconds: 30,
  digits: 6,
  // Steps accepted either side of now: 1 = the previous and the next 30 seconds.
  window: 1,
  issuer: "SmartBusiness Checks",
} as const;

// ─── Base32 (RFC 4648): how secrets travel in QR codes and are typed by hand ─

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1; // keep only the bits not written yet
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch);
    if (index === -1) throw new Error("Not a base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(bytes);
}

// ─── Codes ──────────────────────────────────────────────────

// 160 random bits, the size RFC 4226 recommends (the length of an HMAC-SHA1 key block).
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepAt(unixMs: number): number {
  return Math.floor(unixMs / 1000 / TOTP.stepSeconds);
}

export function codeAt(secret: string, step: number, digits: number = TOTP.digits): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  // Dynamic truncation (RFC 4226 §5.3): the last 4 bits say where to read 4 bytes from.
  const offset = mac[mac.length - 1]! & 0x0f;
  const number = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** digits).padStart(digits, "0");
}

// The step a code belongs to (now, or one step either side), or null if it matches none.
// Compared in constant time, so response timing reveals nothing about a near-miss.
export function matchingStep(secret: string, code: string, unixMs: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(unixMs);
  for (const step of [now, now - TOTP.window, now + TOTP.window]) {
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

// What the QR code holds: the format every authenticator app understands.
export function otpauthUrl(secret: string, accountEmail: string): string {
  const label = encodeURIComponent(`${TOTP.issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer: TOTP.issuer,
    algorithm: "SHA1",
    digits: String(TOTP.digits),
    period: String(TOTP.stepSeconds),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
