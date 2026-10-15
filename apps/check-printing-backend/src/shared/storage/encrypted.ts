import { open, seal, type Keyring } from "./envelope.js";
import type { ObjectStorage } from "./types.js";

// Wraps any storage driver: files are sealed before they are handed to the driver,
// and opened (and checked) when they come back. The driver, and anyone who can read
// the folder or bucket, only ever sees encrypted bytes.
//
// Each file is bound to its key, so a file moved or swapped to another name fails
// to open (StorageIntegrityError).
export class EncryptedStorage implements ObjectStorage {
  constructor(
    private readonly inner: ObjectStorage,
    private readonly keyring: Keyring,
  ) {}

  // contentType is not passed on: the stored object is opaque encrypted bytes.
  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    await this.inner.put(key, seal(body, this.keyring, key), "application/octet-stream");
  }

  async get(key: string): Promise<Buffer> {
    return open(await this.inner.get(key), this.keyring, key);
  }

  async delete(key: string): Promise<void> {
    await this.inner.delete(key);
  }
}
