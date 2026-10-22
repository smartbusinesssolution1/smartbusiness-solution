import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

// ═══════════════════════════════════════════════════════════════
// SECRET BOX: AES-256-GCM FOR SECRETS THE SERVER MUST READ BACK
//
// An authenticator secret can't be hashed like a password: the server needs the secret
// itself to calculate the expected code. So it is encrypted with a key that lives in the
// environment, not in the database. A stolen copy of the database alone is useless.
//
// GCM also authenticates: if anyone edits the stored value, decryption fails instead of
// quietly producing a different secret.
//
// Stored as "v1.<iv>.<tag>.<ciphertext>" (base64url): the version lets a future key
// rotation tell old values from new ones.
// ═══════════════════════════════════════════════════════════════

const VERSION = "v1";

export class SecretBox {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) throw new Error("SecretBox needs a 256-bit key (64 hex characters)");
    this.key = Buffer.from(hexKey, "hex");
  }

  seal(plaintext: string): string {
    // A fresh 96-bit IV every time: reusing one with the same key breaks GCM entirely.
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  open(sealed: string): string {
    const [version, iv, tag, ciphertext] = sealed.split(".");
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) throw new Error("Not a sealed value");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  }

  // A keyed fingerprint (HMAC-SHA256): the same input always gives the same 64 hex
  // characters, so it can be looked up, but without the key nobody can test guesses
  // against a stolen copy. Used for backup codes.
  fingerprint(value: string): string {
    return createHmac("sha256", this.key).update(value).digest("hex");
  }
}
