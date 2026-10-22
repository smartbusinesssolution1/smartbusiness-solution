import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeAt, generateSecret, matchingStep, otpauthUrl, stepAt } from "../../src/modules/mfa/totp.js";

// Checked against the published standards, not against itself: if the maths were wrong
// in any detail, authenticator apps would show different codes than the server expects.

// RFC 6238 Appendix B: SHA-1, secret = the ASCII bytes "12345678901234567890", 8 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const RFC_VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("base32 (RFC 4648 test vectors)", () => {
  it.each([
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ])("%s ↔ %s", (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded);
    expect(base32Decode(encoded).toString()).toBe(plain);
  });

  it("decoding ignores spaces, dashes, padding and case (people type secrets by hand)", () => {
    expect(base32Decode("mzxw 6ytb-oi====").toString()).toBe("foobar");
  });

  it("refuses characters outside the alphabet", () => {
    expect(() => base32Decode("MZXW1")).toThrow();
  });
});

describe("TOTP codes (RFC 6238 Appendix B test vectors)", () => {
  it("the RFC secret encodes as the well-known base32 string", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it.each(RFC_VECTORS)("at %i seconds the 8-digit code is %s", (seconds, expected) => {
    expect(codeAt(RFC_SECRET, stepAt(seconds * 1000), 8)).toBe(expected);
  });

  it("the 6-digit code is the last 6 digits of the same number", () => {
    expect(codeAt(RFC_SECRET, stepAt(59_000))).toBe("287082");
  });
});

describe("matching a typed code", () => {
  const secret = generateSecret();
  const now = Date.parse("2026-10-23T12:00:10Z");
  const step = stepAt(now);

  it("accepts the current code, and the previous and next ones (clock drift)", () => {
    expect(matchingStep(secret, codeAt(secret, step), now)).toBe(step);
    expect(matchingStep(secret, codeAt(secret, step - 1), now)).toBe(step - 1);
    expect(matchingStep(secret, codeAt(secret, step + 1), now)).toBe(step + 1);
  });

  it("refuses codes two steps away, wrong codes, and anything that isn't 6 digits", () => {
    expect(matchingStep(secret, codeAt(secret, step - 2), now)).toBeNull();
    expect(matchingStep(secret, codeAt(secret, step + 2), now)).toBeNull();
    const wrong = String((Number(codeAt(secret, step)) + 1) % 1_000_000).padStart(6, "0");
    expect(matchingStep(secret, wrong, now)).toBeNull();
    expect(matchingStep(secret, "12345", now)).toBeNull();
    expect(matchingStep(secret, "12345a", now)).toBeNull();
  });

  it("secrets are 160 random bits (32 base32 characters), different every time", () => {
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateSecret()).not.toBe(secret);
  });
});

describe("otpauth link (what the QR code holds)", () => {
  it("names the issuer and account, and states the algorithm, digits and period", () => {
    const url = new URL(otpauthUrl("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "maria@greenacres.com"));
    expect(url.protocol).toBe("otpauth:");
    expect(url.host).toBe("totp");
    expect(decodeURIComponent(url.pathname)).toBe("/SmartBusiness Checks:maria@greenacres.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      issuer: "SmartBusiness Checks",
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
  });
});
