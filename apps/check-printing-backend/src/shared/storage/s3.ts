import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { assertValidKey, StorageNotFoundError, type ObjectStorage } from "./types.js";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  // Only for S3-compatible services (Cloudflare R2, test servers); empty for AWS.
  endpoint?: string;
  forcePathStyle?: boolean;
  // Also ask S3 to encrypt on its disks. Our own encryption already makes the bucket
  // contents unreadable; this is a second layer, on by default for AWS.
  serverSideEncryption?: "AES256" | "none";
  // Optional prefix inside the bucket, e.g. "production/".
  prefix?: string;
}

// Files in an S3 bucket (AWS S3, or any S3-compatible service). Credentials come from
// the standard AWS sources: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the
// environment, or the server's IAM role in production (preferred: no stored keys).
export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
      forcePathStyle: config.forcePathStyle ?? false,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(key),
        Body: body,
        ContentType: contentType,
        ...(this.config.serverSideEncryption === "AES256" && { ServerSideEncryption: "AES256" }),
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) }),
      );
      return Buffer.from(await result.Body!.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey || (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404)) {
        throw new StorageNotFoundError(key);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) }));
  }

  destroy(): void {
    this.client.destroy();
  }

  private objectKey(key: string): string {
    assertValidKey(key);
    return `${this.config.prefix ?? ""}${key}`;
  }
}
