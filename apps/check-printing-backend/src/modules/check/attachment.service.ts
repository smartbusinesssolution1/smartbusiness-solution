import { createHash, randomUUID, timingSafeEqual } from "crypto";
import sharp from "sharp";
import { AppError, NotFoundError } from "../../shared/errors/index.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { logger } from "../../shared/services/logger.js";
import { StorageIntegrityError, StorageNotFoundError, type ObjectStorage } from "../../shared/storage/index.js";
import { cleanFileName } from "../../shared/utils/file-name.js";
import { detectFileType, MIME_TYPES, type DetectedFileType } from "../../shared/utils/file-type.js";
import { ATTACHMENT_LIMITS, AttachmentRepository } from "./attachment.repository.js";
import type { AuditContext } from "./check.types.js";

// ═══════════════════════════════════════════════════════════════
// CHECK ATTACHMENTS (invoices, receipts): the evidence an approver checks.
//
// Only PDF, PNG and JPEG, by real type. Images are re-encoded (metadata dropped);
// PDFs are kept byte-for-byte. Stored encrypted under a random name; the user's file
// name is only displayed. Added and removed only by the check's creator while the
// check is NEW or REJECTED; after submission they are frozen. Downloads are verified
// against their SHA-256 and audited.
// ═══════════════════════════════════════════════════════════════

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// The 10 MB limit is on the file the person chose. Re-encoding an image can make it bigger
// (an 8.3 MB photo can come out at 12 MB), so the processed image may grow up to this
// ceiling. The 25 MB total per check is counted on the stored size and still applies.
export const MAX_PROCESSED_IMAGE_BYTES = 15 * 1024 * 1024;
// Above this, decoding costs too much memory (a 50 MP image is ~150 MB decoded).
export const MAX_IMAGE_PIXELS = 50_000_000;

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly auditService: AuditService,
    private readonly fileStorage: ObjectStorage,
  ) {}

  async upload(
    checkId: string,
    workspaceId: string,
    file: { buffer: Buffer; originalname?: string } | undefined,
    ctx: AuditContext,
  ) {
    if (!file) {
      throw new AppError('Attach the file in the "file" field.', 400, "MISSING_FILE");
    }

    const type = detectFileType(file.buffer);
    if (!type) {
      throw new AppError("Attach a PDF, PNG or JPEG file.", 415, "UNSUPPORTED_FILE_TYPE");
    }
    // Checked on the file as uploaded (the upload middleware refuses larger files first;
    // this keeps the rule true when the service is called another way).
    if (file.buffer.length > ATTACHMENT_LIMITS.maxFileBytes) {
      throw new AppError("The file must be 10 MB or smaller.", 413, "PAYLOAD_TOO_LARGE");
    }
    const content = await prepareContent(file.buffer, type);

    const fileName = cleanFileName(file.originalname, type === "jpeg" ? "jpg" : type);
    const storageKey = `attachments/${workspaceId}/${checkId}/${randomUUID()}`;
    const digest = sha256(content);

    // The slow part (storing, possibly to S3) happens before the check is locked.
    await this.fileStorage.put(storageKey, content, MIME_TYPES[type]);

    let attachment;
    try {
      attachment = await this.repository.add(checkId, workspaceId, ctx.userId, {
        fileName,
        fileType: MIME_TYPES[type],
        fileSizeBytes: content.length,
        storageKey,
        sha256: digest,
      });
    } catch (err) {
      // Refused (frozen, not the creator, over the limits): leave no orphan file behind.
      await this.fileStorage.delete(storageKey).catch((cleanupErr: unknown) => {
        logger.error({ err: cleanupErr, storageKey }, "Failed to remove an attachment file that was not recorded");
      });
      throw err;
    }

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_ATTACHMENT_ADDED",
      entityType: "Check",
      entityId: checkId,
      details: { attachmentId: attachment.id, fileName, fileType: MIME_TYPES[type], sizeBytes: content.length, sha256: digest },
      ipAddress: ctx.ipAddress,
    });

    return formatAttachment(attachment);
  }

  // Another workspace's check is "not found", never "a check with no attachments".
  async list(checkId: string, workspaceId: string) {
    if (!(await this.repository.checkExists(checkId, workspaceId))) throw new NotFoundError("Check");
    return (await this.repository.list(checkId, workspaceId)).map(formatAttachment);
  }

  async download(checkId: string, attachmentId: string, workspaceId: string, ctx: AuditContext) {
    const attachment = await this.repository.find(attachmentId, checkId, workspaceId);
    if (!attachment) throw new NotFoundError("Attachment");

    let content: Buffer;
    try {
      content = await this.fileStorage.get(attachment.storageKey);
    } catch (err) {
      if (err instanceof StorageNotFoundError) {
        throw new AppError("This attachment's file is missing.", 410, "ATTACHMENT_MISSING");
      }
      if (err instanceof StorageIntegrityError) throw integrityFailed();
      throw err;
    }
    const actual = Buffer.from(sha256(content), "hex");
    const expected = Buffer.from(attachment.sha256, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw integrityFailed();

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_ATTACHMENT_DOWNLOADED",
      entityType: "Check",
      entityId: checkId,
      details: { attachmentId, fileName: attachment.fileName },
      ipAddress: ctx.ipAddress,
    });

    return { content, fileName: attachment.fileName, fileType: attachment.fileType };
  }

  async remove(checkId: string, attachmentId: string, workspaceId: string, ctx: AuditContext) {
    const { attachment, fileStillUsed } = await this.repository.remove(attachmentId, checkId, workspaceId, ctx.userId);

    // A reissued check shares its original's files: delete only when nothing uses it.
    if (!fileStillUsed) {
      await this.fileStorage.delete(attachment.storageKey).catch((err: unknown) => {
        logger.error({ err, storageKey: attachment.storageKey }, "Failed to delete a removed attachment's file");
      });
    }

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_ATTACHMENT_REMOVED",
      entityType: "Check",
      entityId: checkId,
      details: { attachmentId, fileName: attachment.fileName, sha256: attachment.sha256, fileDeleted: !fileStillUsed },
      ipAddress: ctx.ipAddress,
    });
  }
}

// Images are decoded and re-encoded: this drops metadata (GPS, device) and anything
// hidden after the image data, and refuses files that are not really images.
export async function prepareContent(buffer: Buffer, type: DetectedFileType): Promise<Buffer> {
  if (type === "pdf") return buffer;
  const unreadable = () => new AppError("This image could not be read. Attach a valid PNG or JPEG.", 422, "INVALID_IMAGE");

  // The size is read from the header first, so a very large photo is told it is too
  // large instead of "could not be read" (which is what sharp's own pixel limit gives).
  const { width, height } = await sharp(buffer).metadata().catch(() => {
    throw unreadable();
  });
  if (!width || !height) throw unreadable();
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new AppError(
      `This image is too large (${Math.round((width * height) / 1_000_000)} megapixels; the most is 50). Resize it and try again.`,
      422,
      "IMAGE_TOO_LARGE",
    );
  }

  let content: Buffer;
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" }).rotate();
    content = type === "png" ? await image.png().toBuffer() : await image.jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw unreadable();
  }
  if (content.length > MAX_PROCESSED_IMAGE_BYTES) {
    throw new AppError("This image is too large once processed. Resize it, or save it as a JPEG, and try again.", 413, "PAYLOAD_TOO_LARGE");
  }
  return content;
}

function integrityFailed(): AppError {
  return new AppError("This attachment failed its integrity check and was not served.", 409, "ATTACHMENT_INTEGRITY_FAILED");
}

export function formatAttachment(a: {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: bigint;
  createdAt: Date;
  uploadedBy: { id: string; fullName: string };
}) {
  return {
    id: a.id,
    fileName: a.fileName,
    fileType: a.fileType,
    // BigInt does not survive JSON; files are far below 2^53 bytes.
    sizeBytes: Number(a.fileSizeBytes),
    uploadedBy: { id: a.uploadedBy.id, fullName: a.uploadedBy.fullName },
    createdAt: a.createdAt,
  };
}
