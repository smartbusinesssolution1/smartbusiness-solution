import { buildKeyring } from "./envelope.js";
import { EncryptedStorage } from "./encrypted.js";
import { LocalDiskStorage } from "./local-disk.js";
import { S3Storage, type S3StorageConfig } from "./s3.js";
import type { ObjectStorage } from "./types.js";

export * from "./types.js";
export { StorageIntegrityError, buildKeyring, type Keyring } from "./envelope.js";
export { EncryptedStorage } from "./encrypted.js";
export { LocalDiskStorage } from "./local-disk.js";
export { S3Storage, type S3StorageConfig } from "./s3.js";

export interface StorageConfig {
  driver: "local" | "s3";
  localDirectory: string;
  s3: S3StorageConfig;
  encryption: {
    currentKey: { id: string; hex: string };
    previousKeys: Array<{ id: string; hex: string }>;
  };
}

// Builds the storage for this environment: the configured driver, always wrapped in
// encryption. There is deliberately no way to get an unencrypted store from config.
export function createStorage(config: StorageConfig): ObjectStorage {
  const driver: ObjectStorage =
    config.driver === "s3" ? new S3Storage(config.s3) : new LocalDiskStorage(config.localDirectory);
  return new EncryptedStorage(driver, buildKeyring(config.encryption.currentKey, config.encryption.previousKeys));
}
