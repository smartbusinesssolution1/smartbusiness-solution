import { createHash, randomBytes } from "crypto";

// An "opaque" token is a random secret with no meaning inside it (unlike a JWT).
// Used for refresh tokens and one-time email links.
//
// 32 bytes = 256 bits from the operating system's secure random source; base64url
// makes it 43 characters that are safe in URLs and cookies.
//
// Stored as a SHA-256 fingerprint. A fast hash is right here (passwords need a slow
// one): the token is 256 random bits, so there is no list of likely values to try,
// and a plain hash can be looked up directly through a database index.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashOpaqueToken(raw) };
}

export function hashOpaqueToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// True when `raw` has the shape of a token we issue: lets callers reject garbage
// without touching the database.
export function looksLikeOpaqueToken(raw: unknown): raw is string {
  return typeof raw === "string" && TOKEN_PATTERN.test(raw);
}
