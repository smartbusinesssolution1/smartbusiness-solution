import { randomBytes, randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildKeyring,
  EncryptedStorage,
  S3Storage,
  StorageIntegrityError,
  StorageNotFoundError,
} from "../../src/shared/storage/index.js";
import { TEST_S3 } from "../setup/test-env.js";

// #2: the S3 driver against the S3 API, using S3Mock from docker-compose.test.yml.
// Production uses the same code against AWS.

const s3 = new S3Storage({
  bucket: TEST_S3.bucket,
  region: TEST_S3.region,
  endpoint: TEST_S3.endpoint,
  forcePathStyle: true,
  serverSideEncryption: "none",
  prefix: `run-${randomUUID()}/`,
});
const keyring = buildKeyring({ id: "s3test", hex: randomBytes(32).toString("hex") });
const encrypted = new EncryptedStorage(s3, keyring);
const PDF = Buffer.from("%PDF-1.7\nPay to ABC Supplies $4,800.00 987654321012\n%%EOF\n");

beforeAll(async () => {
  try {
    await s3.get("probe/does-not-exist.txt");
  } catch (err) {
    if (!(err instanceof StorageNotFoundError)) {
      throw new Error(
        "Cannot reach the S3 test server. Start it with: pnpm --filter @smartbusiness/check-printing-backend test:db:up\n" +
          String(err),
      );
    }
  }
});

afterAll(() => {
  s3.destroy();
});

describe("S3Storage", () => {
  it("stores, reads and deletes an object", async () => {
    const key = `checks/ws-1/${randomUUID()}.pdf`;
    await s3.put(key, PDF, "application/pdf");
    expect(await s3.get(key)).toEqual(PDF);

    await s3.delete(key);
    await expect(s3.get(key)).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it("reports a missing object as not found", async () => {
    await expect(s3.get(`checks/${randomUUID()}.pdf`)).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it("refuses an invalid key before calling S3", async () => {
    await expect(s3.get("../outside.pdf")).rejects.toThrow(/Invalid storage key/);
  });
});

describe("EncryptedStorage over S3", () => {
  it("puts only encrypted bytes in the bucket and reads the PDF back", async () => {
    const key = `checks/ws-1/${randomUUID()}.pdf`;
    await encrypted.put(key, PDF, "application/pdf");

    const inBucket = await s3.get(key);
    expect(inBucket.subarray(0, 4).toString()).toBe("SBE1");
    expect(inBucket.toString("latin1")).not.toContain("987654321012");
    expect(await encrypted.get(key)).toEqual(PDF);
  });

  it("refuses an object that was swapped in from another key", async () => {
    const a = `checks/ws-1/${randomUUID()}.pdf`;
    const b = `checks/ws-1/${randomUUID()}.pdf`;
    await encrypted.put(a, PDF, "application/pdf");
    await s3.put(b, await s3.get(a), "application/octet-stream");

    await expect(encrypted.get(b)).rejects.toBeInstanceOf(StorageIntegrityError);
  });
});
