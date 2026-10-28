import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../config/index.js";
import { UPLOADS_DIR } from "../utils/uploadDir.js";
import { logger } from "./logger.js";
import { AppError } from "../errors/index.js";

export interface UploadAvatarResult {
  url: string;
  key?: string;
}

interface MemoryCacheEntry {
  buffer: Buffer;
  expiresAt: number;
}

export class StorageService {
  private s3Client: S3Client | null = null;
  private readonly isS3Enabled: boolean;
  private readonly avatarsLocalDir = path.join(UPLOADS_DIR, "avatars");

  // ── L1 In-Memory RAM Cache for Hot Avatar/Baseline Buffers ───────
  private memoryBufferCache = new Map<string, MemoryCacheEntry>();
  private readonly memoryCacheTtlMs = 1000 * 60 * 60 * 12; // 12 hours TTL in RAM
  private readonly maxMemoryEntries = 500; // Store up to 500 hot employee baseline photos

  constructor() {
    this.isS3Enabled = Boolean(
      env.aws.bucketName && env.aws.accessKeyId && env.aws.secretAccessKey
    );

    // Ensure local storage directory always exists for fallback & disk cache
    if (!fs.existsSync(this.avatarsLocalDir)) {
      fs.mkdirSync(this.avatarsLocalDir, { recursive: true });
    }

    if (this.isS3Enabled) {
      this.s3Client = new S3Client({
        region: env.aws.region,
        useDualstackEndpoint: true,
        credentials: {
          accessKeyId: env.aws.accessKeyId!,
          secretAccessKey: env.aws.secretAccessKey!,
        },
        maxAttempts: 2,
      });
      logger.info(
        {
          bucket: env.aws.bucketName,
          region: env.aws.region,
          dualstack: true,
        },
        "S3 Storage Service initialized for bucket"
      );
    } else {
      logger.info(
        "AWS S3 credentials not provided. StorageService running in local disk mode."
      );
    }
  }

  /**
   * Internal helper: Store buffer in L1 RAM cache (with LRU eviction)
   */
  private cacheBufferInMemory(key: string, buffer: Buffer): void {
    if (this.memoryBufferCache.size >= this.maxMemoryEntries) {
      const oldestKey = this.memoryBufferCache.keys().next().value;
      if (oldestKey) this.memoryBufferCache.delete(oldestKey);
    }
    this.memoryBufferCache.set(key, {
      buffer,
      expiresAt: Date.now() + this.memoryCacheTtlMs,
    });
  }

  /**
   * Internal helper: Store buffer in both L1 RAM and L2 disk cache
   */
  private saveToCache(key: string, buffer: Buffer, diskPath?: string): void {
    this.cacheBufferInMemory(key, buffer);

    if (diskPath) {
      fs.promises.writeFile(diskPath, buffer).catch((err) => {
        logger.warn({ error: err.message, diskPath }, "Failed to write disk cache copy for image");
      });
    }
  }

  /**
   * Upload an employee avatar photograph.
   * If AWS S3 credentials are configured, uploads to S3 and returns the direct S3 URL.
   * Otherwise falls back safely to local disk storage.
   */
  async uploadAvatar(params: {
    tenantId: string;
    file: Express.Multer.File;
  }): Promise<UploadAvatarResult> {
    const { tenantId, file } = params;

    if (!file || !file.buffer) {
      throw new AppError("Invalid or empty file payload.", 400, "INVALID_FILE_PAYLOAD");
    }

    const rawExt = path.extname(file.originalname).toLowerCase() || ".jpg";
    const ext = [".jpg", ".jpeg", ".png", ".webp"].includes(rawExt) ? rawExt : ".jpg";
    const uniqueHash = crypto.randomBytes(8).toString("hex");

    if (this.isS3Enabled && this.s3Client) {
      const key = `tenants/${tenantId}/avatars/${Date.now()}-${uniqueHash}${ext}`;

      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: env.aws.bucketName!,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );

        // Direct AWS S3 URL with dualstack support
        const publicUrl = `https://${env.aws.bucketName}.s3.dualstack.${env.aws.region}.amazonaws.com/${key}`;

        // Pre-warm the cache immediately with the uploaded buffer
        this.cacheBufferInMemory(publicUrl, file.buffer);

        logger.info({ key, s3Url: publicUrl }, "Avatar uploaded to AWS S3 (pre-cached in RAM)");

        return {
          url: publicUrl,
          key,
        };
      } catch (error: any) {
        logger.warn(
          { error: error.message, key },
          "Failed to upload avatar to AWS S3, falling back safely to local disk storage"
        );
        // Fall back gracefully to local disk below
      }
    }

    // Local Disk Fallback
    const filename = `avatar-${Date.now()}-${uniqueHash}${ext}`;
    const destinationPath = path.join(this.avatarsLocalDir, filename);

    try {
      await fs.promises.writeFile(destinationPath, file.buffer);
      const localUrl = `/uploads/avatars/${filename}`;
      this.cacheBufferInMemory(localUrl, file.buffer);
      return { url: localUrl };
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to write avatar to local disk");
      throw new AppError("Failed to save employee profile image.", 500, "LOCAL_STORAGE_ERROR");
    }
  }

  /**
   * Delete an avatar from AWS S3 or local disk when replaced or employee removed.
   * Also purges any cached RAM and disk copies.
   */
  async deleteAvatar(avatarUrl?: string | null): Promise<void> {
    if (!avatarUrl) return;

    // Purge from RAM cache
    this.memoryBufferCache.delete(avatarUrl);

    // Purge from disk cache (non-blocking)
    const diskCacheFilename = `cached-${crypto.createHash("md5").update(avatarUrl).digest("hex")}.jpg`;
    const diskCachePath = path.join(this.avatarsLocalDir, diskCacheFilename);
    await fs.promises.unlink(diskCachePath).catch(() => {});

    try {
      // 1. AWS S3 / CloudFront URL
      if (this.isS3Enabled && this.s3Client && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))) {
        const urlObj = new URL(avatarUrl);
        // Extract S3 object key (remove leading slash)
        const key = urlObj.pathname.replace(/^\/+/, "");

        if (key && key.startsWith("tenants/")) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: env.aws.bucketName!,
              Key: key,
            })
          );
          logger.info({ key }, "Cleaned up old avatar from S3");
        }
        return;
      }

      // 2. Local disk file (/uploads/avatars/avatar-...)
      if (avatarUrl.startsWith("/uploads/avatars/")) {
        const filename = path.basename(avatarUrl);
        const localAvatarPath = path.join(this.avatarsLocalDir, filename);
        await fs.promises.unlink(localAvatarPath).catch(() => {});
        logger.info({ filename }, "Cleaned up local avatar file");
      }
    } catch (err: any) {
      // Non-fatal cleanup error
      logger.warn({ error: err.message, avatarUrl }, "Failed to remove previous avatar file");
    }
  }

  /**
   * Retrieve file buffer from S3 URL or local uploads path.
   * Utilizes a two-tier cache (L1 Memory Cache in RAM -> L2 Disk Cache -> Remote S3/HTTP).
   */
  async getFileBuffer(urlOrPath: string): Promise<Buffer> {
    if (!urlOrPath) {
      throw new AppError("No file URL or path provided", 400, "ERR_INVALID_FILE_PATH");
    }

    // ── Tier 1: Check In-Memory RAM Cache (0 ms) ───────────────────
    const cachedMemory = this.memoryBufferCache.get(urlOrPath);
    if (cachedMemory && Date.now() < cachedMemory.expiresAt) {
      return cachedMemory.buffer;
    }

    // ── Tier 2: Check Local Disk Cache (<1 ms) ─────────────────────
    const diskCacheFilename = `cached-${crypto.createHash("md5").update(urlOrPath).digest("hex")}.jpg`;
    const diskCachePath = path.join(this.avatarsLocalDir, diskCacheFilename);
    if (fs.existsSync(diskCachePath)) {
      try {
        const diskBuffer = await fs.promises.readFile(diskCachePath);
        this.cacheBufferInMemory(urlOrPath, diskBuffer);
        return diskBuffer;
      } catch {
        // Fall through to remote fetch if disk read fails
      }
    }

    // ── Tier 3: Fetch from Remote Storage (S3 / HTTP) ──────────────
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      // 1. If S3 is enabled and URL points to our S3 bucket, use authenticated S3Client with dualstack
      if (this.isS3Enabled && this.s3Client) {
        try {
          const urlObj = new URL(urlOrPath);
          const isOurS3Bucket =
            (env.aws.bucketName && urlObj.hostname.includes(env.aws.bucketName)) ||
            urlObj.hostname.includes(".amazonaws.com");

          if (isOurS3Bucket) {
            const key = urlObj.pathname.replace(/^\/+/, "");
            if (key) {
              const res = await this.s3Client.send(
                new GetObjectCommand({
                  Bucket: env.aws.bucketName!,
                  Key: key,
                })
              );
              if (res.Body) {
                const byteArray = await res.Body.transformToByteArray();
                const buffer = Buffer.from(byteArray);
                this.saveToCache(urlOrPath, buffer, diskCachePath);
                return buffer;
              }
            }
          }
        } catch (s3Error: any) {
          logger.warn(
            { error: s3Error.message, url: urlOrPath },
            "Failed to retrieve image via S3Client, attempting direct fetch fallback"
          );
        }
      }

      // 2. Fallback to direct HTTP fetch with dualstack rewrite and 5-second timeout
      try {
        let targetUrl = urlOrPath;
        if (targetUrl.includes(".s3.") && !targetUrl.includes(".s3.dualstack.")) {
          targetUrl = targetUrl.replace(".s3.", ".s3.dualstack.");
        }

        const response = await fetch(targetUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          throw new AppError(`Failed to fetch image from URL: ${targetUrl}`, 400, "ERR_DOWNLOAD_FAILED");
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        this.saveToCache(urlOrPath, buffer, diskCachePath);
        return buffer;
      } catch (fetchErr: any) {
        logger.error({ error: fetchErr.message, url: urlOrPath }, "Failed to fetch remote image");
        throw new AppError(`Failed to fetch image from remote URL: ${fetchErr.message}`, 502, "ERR_DOWNLOAD_FAILED");
      }
    }

    // ── Local Disk Storage (/uploads/...) ──────────────────────────
    const relativePart = urlOrPath.replace(/^\/?uploads\//, "");
    const localFilePath = path.join(UPLOADS_DIR, relativePart);
    if (fs.existsSync(localFilePath)) {
      const buffer = await fs.promises.readFile(localFilePath);
      this.cacheBufferInMemory(urlOrPath, buffer);
      return buffer;
    }

    if (fs.existsSync(urlOrPath)) {
      const buffer = await fs.promises.readFile(urlOrPath);
      this.cacheBufferInMemory(urlOrPath, buffer);
      return buffer;
    }

    throw new AppError(`File not found: ${urlOrPath}`, 404, "ERR_FILE_NOT_FOUND");
  }
}

export const storageService = new StorageService();
