// ═══════════════════════════════════════════════════════════════
// OBJECT STORAGE: where files (check PDFs, signatures, attachments) are kept.
//
// One small interface; drivers decide WHERE bytes live (a local folder, an S3
// bucket), and EncryptedStorage wraps any driver to decide HOW they are protected.
// Keys are names like "checks/<workspace>/check-<id>-<uuid>.pdf".
// ═══════════════════════════════════════════════════════════════

export interface ObjectStorage {
  // Never overwrites: every key is written once.
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  // Throws StorageNotFoundError when the key does not exist.
  get(key: string): Promise<Buffer>;
  // Succeeds whether or not the key exists.
  delete(key: string): Promise<void>;
}

export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`No stored file named "${key}"`);
    this.name = "StorageNotFoundError";
  }
}

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key "${key}"`);
    this.name = "InvalidStorageKeyError";
  }
}

// Letters, digits, "-", "_", "." in segments separated by "/". No "..", no leading
// "/", no empty segments: a key can never point outside its storage area, whatever
// the driver.
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

export function assertValidKey(key: string): void {
  const segments = key.split("/");
  const ok =
    key.length > 0 &&
    key.length <= 512 &&
    segments.every((s) => SEGMENT.test(s) && s !== "." && s !== "..");
  if (!ok) throw new InvalidStorageKeyError(key);
}
