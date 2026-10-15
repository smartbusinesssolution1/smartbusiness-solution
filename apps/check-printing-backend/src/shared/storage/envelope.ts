import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ═══════════════════════════════════════════════════════════════
// ENVELOPE ENCRYPTION FOR STORED FILES
//
// Each file gets its own random 256-bit data key. The file is encrypted with the
// data key (AES-256-GCM); the data key is encrypted with the master key and stored
// in the file's header together with the master key's id. So:
//   - rotating the master key only means re-wrapping small data keys,
//   - several master keys can be in use during a rotation (looked up by id),
//   - one file's data key opens only that file.
//
// The file is bound to its storage key (AES-GCM "additional authenticated data"):
// a sealed file copied or swapped to another name fails to open.
//
// Layout:
//   "SBE1" | idLen (1 byte) | keyId | wrapIv (12) | wrappedKey (32) | wrapTag (16)
//          | dataIv (12) | dataTag (16) | ciphertext
// ═══════════════════════════════════════════════════════════════

const MAGIC = Buffer.from("SBE1", "ascii");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export interface MasterKey {
  id: string;
  key: Buffer; // 32 bytes
}

// The key used to seal new files, plus every key that may still open older ones.
export interface Keyring {
  current: MasterKey;
  all: Map<string, Buffer>;
}

export class StorageIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageIntegrityError";
  }
}

export function seal(plaintext: Buffer, keyring: Keyring, binding: string): Buffer {
  const { id, key } = keyring.current;
  const idBytes = Buffer.from(id, "utf8");
  if (idBytes.length === 0 || idBytes.length > 255) throw new Error("Master key id must be 1–255 bytes");

  const dataKey = randomBytes(KEY_LENGTH);

  const wrapIv = randomBytes(IV_LENGTH);
  const wrapper = createCipheriv("aes-256-gcm", key, wrapIv);
  wrapper.setAAD(idBytes);
  const wrappedKey = Buffer.concat([wrapper.update(dataKey), wrapper.final()]);
  const wrapTag = wrapper.getAuthTag();

  const dataIv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", dataKey, dataIv);
  cipher.setAAD(Buffer.from(binding, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const dataTag = cipher.getAuthTag();

  return Buffer.concat([
    MAGIC,
    Buffer.from([idBytes.length]),
    idBytes,
    wrapIv,
    wrappedKey,
    wrapTag,
    dataIv,
    dataTag,
    ciphertext,
  ]);
}

export function open(sealed: Buffer, keyring: Keyring, binding: string): Buffer {
  if (sealed.length < MAGIC.length + 1 || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new StorageIntegrityError("Not an encrypted file (missing header)");
  }

  let offset = MAGIC.length;
  const idLength = sealed[offset]!;
  offset += 1;
  const minLength = offset + idLength + IV_LENGTH + KEY_LENGTH + TAG_LENGTH + IV_LENGTH + TAG_LENGTH;
  if (sealed.length < minLength) throw new StorageIntegrityError("Encrypted file is truncated");

  const idBytes = sealed.subarray(offset, offset + idLength);
  offset += idLength;
  const take = (n: number) => {
    const part = sealed.subarray(offset, offset + n);
    offset += n;
    return part;
  };
  const wrapIv = take(IV_LENGTH);
  const wrappedKey = take(KEY_LENGTH);
  const wrapTag = take(TAG_LENGTH);
  const dataIv = take(IV_LENGTH);
  const dataTag = take(TAG_LENGTH);
  const ciphertext = sealed.subarray(offset);

  const keyId = idBytes.toString("utf8");
  const masterKey = keyring.all.get(keyId);
  if (!masterKey) throw new StorageIntegrityError(`Encrypted with unknown master key "${keyId}"`);

  try {
    const unwrapper = createDecipheriv("aes-256-gcm", masterKey, wrapIv);
    unwrapper.setAAD(idBytes);
    unwrapper.setAuthTag(wrapTag);
    const dataKey = Buffer.concat([unwrapper.update(wrappedKey), unwrapper.final()]);

    const decipher = createDecipheriv("aes-256-gcm", dataKey, dataIv);
    decipher.setAAD(Buffer.from(binding, "utf8"));
    decipher.setAuthTag(dataTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM refuses anything modified, truncated, swapped to another name, or sealed
    // with a different key under the same id.
    throw new StorageIntegrityError("Encrypted file failed its integrity check");
  }
}

// Builds a keyring from the configured current key and any previous keys still in use.
export function buildKeyring(current: { id: string; hex: string }, previous: Array<{ id: string; hex: string }> = []): Keyring {
  const toKey = (hex: string, id: string) => {
    const key = Buffer.from(hex, "hex");
    if (key.length !== KEY_LENGTH) throw new Error(`Storage key "${id}" must be 64 hex characters (32 bytes)`);
    return key;
  };
  const all = new Map<string, Buffer>();
  for (const k of previous) all.set(k.id, toKey(k.hex, k.id));
  const currentKey = toKey(current.hex, current.id);
  all.set(current.id, currentKey);
  return { current: { id: current.id, key: currentKey }, all };
}
