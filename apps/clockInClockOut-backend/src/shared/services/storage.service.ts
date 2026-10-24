import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../config/index.js";
import { UPLOADS_DIR } from "../utils/uploadDir.js";
import { logger } from "./logger.js";
import { AppError } from "../errors/index.js";

export interface UploadAvatarResult {
  url: string;
  key?: string;
}

export class StorageService {
  private s3Client: S3Client | null = null;
  private readonly isS3Enabled: boolean;
  private readonly avatarsLocalDir = path.join(UPLOADS_DIR, "avatars");

  constructor() {
    this.isS3Enabled = Boolean(
      env.aws.bucketName && env.aws.accessKeyId && env.aws.secretAccessKey
    );

    // Ensure local storage directory always exists for fallback
    if (!fs.existsSync(this.avatarsLocalDir)) {
      fs.mkdirSync(this.avatarsLocalDir, { recursive: true });
    }

    if (this.isS3Enabled) {
      this.s3Client = new S3Client({
        region: env.aws.region,
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

        // Direct AWS S3 URL
        const publicUrl = `https://${env.aws.bucketName}.s3.${env.aws.region}.amazonaws.com/${key}`;

        logger.info({ key, s3Url: publicUrl }, "Avatar uploaded to AWS S3");

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
      return { url: localUrl };
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to write avatar to local disk");
      throw new AppError("Failed to save employee profile image.", 500, "LOCAL_STORAGE_ERROR");
    }
  }

  /**
   * Delete an avatar from AWS S3 or local disk when replaced or employee removed
   */
  async deleteAvatar(avatarUrl?: string | null): Promise<void> {
    if (!avatarUrl) return;

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
        const filePath = path.join(this.avatarsLocalDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info({ filename }, "Cleaned up local avatar file");
        }
      }
    } catch (err: any) {
      // Non-fatal cleanup error
      logger.warn({ error: err.message, avatarUrl }, "Failed to remove previous avatar file");
    }
  }

  /**
   * Retrieve file buffer from S3 URL or local uploads path
   */
  async getFileBuffer(urlOrPath: string): Promise<Buffer> {
    if (!urlOrPath) {
      throw new AppError("No file URL or path provided", 400, "ERR_INVALID_FILE_PATH");
    }

    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      const response = await fetch(urlOrPath);
      if (!response.ok) {
        throw new AppError(`Failed to fetch image from URL: ${urlOrPath}`, 400, "ERR_DOWNLOAD_FAILED");
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const relativePart = urlOrPath.replace(/^\/?uploads\//, "");
    const localFilePath = path.join(UPLOADS_DIR, relativePart);
    if (fs.existsSync(localFilePath)) {
      return await fs.promises.readFile(localFilePath);
    }

    if (fs.existsSync(urlOrPath)) {
      return await fs.promises.readFile(urlOrPath);
    }

    throw new AppError(`File not found: ${urlOrPath}`, 404, "ERR_FILE_NOT_FOUND");
  }
}

export const storageService = new StorageService();
