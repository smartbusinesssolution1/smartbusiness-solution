import { describe, expect, it, vi } from "vitest";
import { StorageNotFoundError, type ObjectStorage } from "./types.js";
import { checkStorage, explainStorageError, refusesToStartOnStorageFailure, verifyStorageAtStartup, type StorageLocation } from "./startup-check.js";

// The startup check against an in-memory storage that can be told to fail the way S3
// does (an error with a name and an HTTP status in $metadata).

const S3: StorageLocation = { driver: "s3", bucket: "check-printing-bucket", prefix: "development/", region: "ap-south-1" };
const noWait = { sleep: async () => {} };

function s3Error(name: string, status?: number): Error {
  const err = new Error(`${name} from S3`);
  err.name = name;
  Object.assign(err, { $metadata: { httpStatusCode: status } });
  return err;
}

function networkError(code: string): Error {
  return Object.assign(new Error(`getaddrinfo ${code}`), { code });
}

type Op = "put" | "get" | "delete";

// A working in-memory store; `fail` makes chosen calls throw.
function memoryStorage(fail: Partial<Record<Op, (call: number) => Error | null>> = {}, options: { corrupt?: boolean; missingAs403?: boolean } = {}) {
  const files = new Map<string, Buffer>();
  const calls: Record<Op, number> = { put: 0, get: 0, delete: 0 };
  const failIfAsked = (op: Op) => {
    calls[op]++;
    const err = fail[op]?.(calls[op]);
    if (err) throw err;
  };
  const storage: ObjectStorage = {
    async put(key, body) {
      failIfAsked("put");
      files.set(key, Buffer.from(body));
    },
    async get(key) {
      failIfAsked("get");
      const file = files.get(key);
      if (!file) {
        if (options.missingAs403) throw s3Error("AccessDenied", 403);
        throw new StorageNotFoundError(key);
      }
      return options.corrupt ? Buffer.from("something else") : file;
    },
    async delete(key) {
      failIfAsked("delete");
      files.delete(key);
    },
  };
  return { storage, files, calls };
}

describe("checkStorage", () => {
  it("passes on working storage: writes, reads back, deletes, and leaves nothing behind", async () => {
    const { storage, files, calls } = memoryStorage();

    const result = await checkStorage(storage, S3, noWait);

    expect(result).toEqual({ ok: true, attempts: 1, missingFileIsNotFound: true });
    expect(calls).toEqual({ put: 1, get: 2, delete: 1 });
    expect(files.size).toBe(0);
  });

  it("writes only under its own folder, inside the configured prefix", async () => {
    const keys: string[] = [];
    const { storage } = memoryStorage();
    const spying: ObjectStorage = { ...storage, put: (key, body, type) => (keys.push(key), storage.put(key, body, type)) };

    await checkStorage(spying, S3, noWait);

    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^_startup-check\/[0-9a-f-]{36}\.bin$/);
  });

  it("fails without retrying when S3 refuses the write (missing IAM permission)", async () => {
    const { storage, calls } = memoryStorage({ put: () => s3Error("AccessDenied", 403) });

    const result = await checkStorage(storage, S3, noWait);

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(calls.put).toBe(1);
    expect(!result.ok && result.reason).toContain("s3:PutObject, s3:GetObject and s3:DeleteObject on arn:aws:s3:::check-printing-bucket/development/*");
  });

  it("retries a network blip and passes once S3 answers", async () => {
    const sleep = vi.fn(async () => {});
    const { storage } = memoryStorage({ put: (n) => (n < 3 ? networkError("ECONNRESET") : null) });

    const result = await checkStorage(storage, S3, { sleep, retryDelayMs: 100 });

    expect(result).toMatchObject({ ok: true, attempts: 3 });
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it("gives up after the last attempt when S3 stays unreachable", async () => {
    const { storage, calls } = memoryStorage({ put: () => networkError("ETIMEDOUT") });

    const result = await checkStorage(storage, S3, { ...noWait, attempts: 3 });

    expect(result).toMatchObject({ ok: false, attempts: 3 });
    expect(calls.put).toBe(3);
    expect(!result.ok && result.reason).toContain("S3 could not be reached");
  });

  it("fails when the file reads back differently, and still removes it", async () => {
    const { storage, files } = memoryStorage({}, { corrupt: true });

    const result = await checkStorage(storage, S3, noWait);

    expect(result).toMatchObject({ ok: false, reason: "The test file read back differently from what was written." });
    expect(files.size).toBe(0);
  });

  it("fails when files can't be deleted: the app deletes files too", async () => {
    const { storage } = memoryStorage({ delete: () => s3Error("AccessDenied", 403) });

    const result = await checkStorage(storage, S3, noWait);

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("passes but notes it when a missing file comes back as 403 (no s3:ListBucket)", async () => {
    const { storage } = memoryStorage({}, { missingAs403: true });

    const result = await checkStorage(storage, S3, noWait);

    expect(result).toEqual({ ok: true, attempts: 1, missingFileIsNotFound: false });
  });
});

describe("explainStorageError: the setting to fix", () => {
  it.each([
    [s3Error("NoSuchBucket", 404), "Check S3_BUCKET"],
    [s3Error("PermanentRedirect", 301), "Set S3_REGION to the bucket's region"],
    [s3Error("AuthorizationHeaderMalformed", 400), "Set S3_REGION to the bucket's region"],
    [s3Error("InvalidAccessKeyId", 403), "Check AWS_ACCESS_KEY_ID"],
    [s3Error("SignatureDoesNotMatch", 403), "Check AWS_SECRET_ACCESS_KEY"],
    [s3Error("CredentialsProviderError"), "No AWS credentials were found"],
    [networkError("ENOTFOUND"), "Check S3_REGION (a region such as ap-south-1)"],
  ])("%s", (err, hint) => {
    expect(explainStorageError(err, S3)).toContain(hint);
  });

  it("a local folder that can't be written names PDF_STORAGE_PATH", () => {
    const err = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    expect(explainStorageError(err, { driver: "local", localDirectory: "./uploads" })).toContain("Check PDF_STORAGE_PATH");
  });
});

describe("what the server does with the result", () => {
  const logger = () => ({ info: vi.fn(), warn: vi.fn() });

  it("production and staging refuse to start; development and test only warn", () => {
    expect(refusesToStartOnStorageFailure("production")).toBe(true);
    expect(refusesToStartOnStorageFailure("staging")).toBe(true);
    expect(refusesToStartOnStorageFailure("development")).toBe(false);
    expect(refusesToStartOnStorageFailure("test")).toBe(false);
  });

  it("in production a failed check stops the server with the reason", async () => {
    const { storage } = memoryStorage({ put: () => s3Error("NoSuchBucket", 404) });

    await expect(verifyStorageAtStartup(storage, S3, "production", logger(), noWait)).rejects.toThrow(
      /File storage check failed \(s3:\/\/check-printing-bucket\/development\/ \(ap-south-1\)\) after 1 attempt\(s\): .*Check S3_BUCKET/,
    );
  });

  it("in development a failed check is a warning and the server carries on", async () => {
    const { storage } = memoryStorage({ put: () => s3Error("NoSuchBucket", 404) });
    const log = logger();

    const result = await verifyStorageAtStartup(storage, S3, "development", log, noWait);

    expect(result.ok).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("Check S3_BUCKET") }), expect.any(String));
  });

  it("a passing check logs where it checked; a 403-for-missing adds a ListBucket warning", async () => {
    const log = logger();
    await verifyStorageAtStartup(memoryStorage({}, { missingAs403: true }).storage, S3, "production", log, noWait);

    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ storage: "s3://check-printing-bucket/development/ (ap-south-1)" }), expect.any(String));
    expect(log.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining("Grant s3:ListBucket"));
  });
});
