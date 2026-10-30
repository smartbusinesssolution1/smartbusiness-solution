import { randomBytes, randomUUID } from "crypto";
import { StorageIntegrityError } from "./envelope.js";
import { StorageNotFoundError, type ObjectStorage } from "./types.js";

// ═══════════════════════════════════════════════════════════════
// FILE STORAGE CHECK AT STARTUP
//
// A wrong bucket, region, key or IAM policy used to show up only when someone first
// printed a check or uploaded a signature. At startup the server now writes a small
// encrypted test file through the same storage the app uses, reads it back, compares
// it and deletes it: exactly the three permissions the app needs (s3:PutObject,
// s3:GetObject, s3:DeleteObject), the encryption key, and the network path.
//
// It also reads a file that doesn't exist. S3 answers 404 only when the caller may list
// the bucket (s3:ListBucket); otherwise it answers 403, and a missing check PDF would be
// reported as a server error instead of "not found". That case is a warning, not a
// failure.
//
// Production and staging refuse to start when the check fails (like a bad environment
// variable); development only warns, so other work can go on without S3 access.
// Network blips and S3 hiccups are retried; a wrong setting is not, it won't fix itself.
// ═══════════════════════════════════════════════════════════════

const PROBE_FOLDER = "_startup-check";

export interface StorageLocation {
  driver: "local" | "s3";
  bucket?: string;
  prefix?: string;
  region?: string;
  localDirectory?: string;
}

export interface StorageCheckOptions {
  attempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export type StorageCheckResult =
  | { ok: true; attempts: number; missingFileIsNotFound: boolean }
  | { ok: false; attempts: number; reason: string; error: unknown };

class StorageCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageCheckError";
  }
}

export async function checkStorage(
  storage: ObjectStorage,
  location: StorageLocation,
  options: StorageCheckOptions = {},
): Promise<StorageCheckResult> {
  const attempts = options.attempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await writeReadDelete(storage);
      return { ok: true, attempts: attempt, missingFileIsNotFound: await missingFileIsNotFound(storage) };
    } catch (err) {
      lastError = err;
      if (isPermanent(err) || attempt === attempts) {
        return { ok: false, attempts: attempt, reason: explainStorageError(err, location), error: err };
      }
      await sleep(retryDelayMs * attempt);
    }
  }
  return { ok: false, attempts, reason: explainStorageError(lastError, location), error: lastError };
}

async function writeReadDelete(storage: ObjectStorage): Promise<void> {
  const key = `${PROBE_FOLDER}/${randomUUID()}.bin`;
  const body = randomBytes(32);
  await storage.put(key, body, "application/octet-stream");

  let back: Buffer;
  try {
    back = await storage.get(key);
  } catch (err) {
    await storage.delete(key).catch(() => {});
    throw err;
  }
  if (!back.equals(body)) {
    await storage.delete(key).catch(() => {});
    throw new StorageCheckError("The test file read back differently from what was written.");
  }

  // Not best-effort: the app deletes files too (a removed attachment, a lost print race).
  await storage.delete(key);
}

async function missingFileIsNotFound(storage: ObjectStorage): Promise<boolean> {
  try {
    await storage.get(`${PROBE_FOLDER}/missing-${randomUUID()}.bin`);
    throw new StorageCheckError("Reading a file that doesn't exist returned data.");
  } catch (err) {
    if (err instanceof StorageNotFoundError) return true;
    if (httpStatus(err) === 403) return false;
    throw err;
  }
}

// What the server does with a failed check: refuse to start where real customers are,
// warn where a developer is working.
export function refusesToStartOnStorageFailure(nodeEnv: string): boolean {
  return nodeEnv === "production" || nodeEnv === "staging";
}

interface StartupLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

// Runs the check and logs the outcome. Throws (so the server stops) only when the
// environment refuses to start on a failed check.
export async function verifyStorageAtStartup(
  storage: ObjectStorage,
  location: StorageLocation,
  nodeEnv: string,
  logger: StartupLogger,
  options?: StorageCheckOptions,
): Promise<StorageCheckResult> {
  const where = describeLocation(location);
  const result = await checkStorage(storage, location, options);

  if (result.ok) {
    logger.info({ storage: where, attempts: result.attempts }, "File storage check passed (write, read, delete)");
    if (!result.missingFileIsNotFound) {
      logger.warn(
        { storage: where },
        "File storage: a missing file is reported as 403, not 404. Grant s3:ListBucket on the bucket so a missing check PDF shows as 'not found' instead of a server error.",
      );
    }
    return result;
  }

  if (refusesToStartOnStorageFailure(nodeEnv)) {
    throw new Error(`File storage check failed (${where}) after ${result.attempts} attempt(s): ${result.reason}`);
  }
  logger.warn(
    { storage: where, attempts: result.attempts, reason: result.reason },
    "File storage check failed: printing, signatures and attachments will not work until this is fixed",
  );
  return result;
}

function describeLocation(location: StorageLocation): string {
  return location.driver === "s3"
    ? `s3://${location.bucket ?? "?"}/${location.prefix ?? ""} (${location.region ?? "?"})`
    : `local folder ${location.localDirectory ?? "?"}`;
}

// ─── Turning S3 and disk errors into the setting to fix ───────────────────

function errorName(err: unknown): string {
  return (err as { name?: string })?.name ?? "";
}

function errorCode(err: unknown): string {
  return (err as { code?: string; Code?: string })?.code ?? (err as { Code?: string })?.Code ?? "";
}

function httpStatus(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

const PERMANENT_NAMES = new Set([
  "AccessDenied",
  "AllAccessDisabled",
  "NoSuchBucket",
  "PermanentRedirect",
  "AuthorizationHeaderMalformed",
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
  "CredentialsProviderError",
  "InvalidBucketName",
  "StorageIntegrityError",
  "StorageCheckError",
]);

function isPermanent(err: unknown): boolean {
  if (err instanceof StorageIntegrityError || err instanceof StorageCheckError) return true;
  if (PERMANENT_NAMES.has(errorName(err))) return true;
  const status = httpStatus(err);
  if (status === 301 || status === 400 || status === 403 || status === 404) return true;
  return ["EACCES", "EPERM", "EROFS"].includes(errorCode(err));
}

export function explainStorageError(err: unknown, location: StorageLocation): string {
  const name = errorName(err);
  const code = errorCode(err);
  const status = httpStatus(err);
  const objects = `arn:aws:s3:::${location.bucket ?? "<bucket>"}/${location.prefix ?? ""}*`;

  if (err instanceof StorageCheckError) return err.message;
  if (err instanceof StorageIntegrityError || name === "StorageIntegrityError") {
    return "A file written with this server's STORAGE_ENCRYPTION_KEY could not be opened again. Check STORAGE_ENCRYPTION_KEY and STORAGE_ENCRYPTION_KEY_ID.";
  }
  if (name === "NoSuchBucket" || (status === 404 && code === "NoSuchBucket")) {
    return `The bucket "${location.bucket}" does not exist. Check S3_BUCKET (the bucket's name, not its ARN).`;
  }
  if (name === "PermanentRedirect" || name === "AuthorizationHeaderMalformed" || status === 301) {
    return `The bucket is not in region "${location.region}". Set S3_REGION to the bucket's region (for example ap-south-1, a region, not an Availability Zone like ap-south-1b).`;
  }
  if (name === "InvalidAccessKeyId") return "AWS does not recognise the access key. Check AWS_ACCESS_KEY_ID (or the server's IAM role).";
  if (name === "SignatureDoesNotMatch") return "The AWS secret key does not match the access key. Check AWS_SECRET_ACCESS_KEY.";
  if (name === "ExpiredToken" || name === "InvalidToken") return "The AWS session credentials have expired. Check the server's IAM role credentials.";
  if (name === "CredentialsProviderError") {
    return "No AWS credentials were found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or give the server an IAM role (with IMDS hop limit 2 for containers).";
  }
  if (name === "AccessDenied" || name === "AllAccessDisabled" || status === 403) {
    return `The AWS credentials are valid but not allowed to use the bucket. Their IAM policy needs s3:PutObject, s3:GetObject and s3:DeleteObject on ${objects} (and s3:ListBucket on the bucket).`;
  }
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return "The S3 address could not be resolved. Check S3_REGION (a region such as ap-south-1), S3_ENDPOINT if set, and the server's DNS.";
  }
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(code) || name === "TimeoutError") {
    return "S3 could not be reached. Check the server's outbound network (security group, NAT, proxy) and S3_ENDPOINT if set.";
  }
  if (["EACCES", "EPERM", "EROFS"].includes(code)) {
    return `The folder "${location.localDirectory}" is not writable. Check PDF_STORAGE_PATH and the folder's permissions.`;
  }
  const message = (err as Error)?.message ?? String(err);
  return `${name || "Error"}${status ? ` (HTTP ${status})` : ""}: ${message}`;
}
