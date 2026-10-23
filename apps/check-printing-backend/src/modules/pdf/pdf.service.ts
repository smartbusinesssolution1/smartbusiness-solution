import * as path from "path";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { AppError } from "../../shared/errors/index.js";
import {
  InvalidStorageKeyError,
  StorageIntegrityError,
  StorageNotFoundError,
  type ObjectStorage,
} from "../../shared/storage/index.js";
import { PdfRenderer } from "./pdf.renderer.js";
import type { CheckPdfData, PaperSize } from "./pdf.types.js";
import { PAPER } from "./pdf.types.js";
import { drawCalibrationSheet } from "./calibration-sheet.js";

export interface StoredPdf {
  // Storage key, e.g. "checks/<workspace>/check-<id>-<uuid>.pdf"
  key: string;
  // SHA-256 of the PDF itself (before encryption), recorded on the check
  sha256: string;
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function integrityFailed(): AppError {
  return new AppError(
    "The stored PDF for this check failed its integrity check and was not served. Void the check and reissue it.",
    409,
    "CHECK_PDF_INTEGRITY_FAILED",
  );
}

export class PdfService {
  constructor(
    private readonly renderer: PdfRenderer,
    // Encrypted storage (local folder or S3): this class never touches files directly.
    private readonly storage: ObjectStorage,
  ) {}

  // Renders without storing: used for calibration samples, which are never saved.
  async renderCheck(data: CheckPdfData): Promise<Buffer> {
    return this.renderer.render(data);
  }

  // Renders and stores a check PDF (encrypted). Returns the storage key and the PDF's
  // SHA-256, so every later download can be verified.
  //
  // Every print attempt gets its own key: if two prints of one check race, the
  // loser's file can never overwrite the PDF that the winning print recorded.
  async generateCheckPdf(
    data: CheckPdfData,
    workspaceId: string,
    checkId: string,
  ): Promise<StoredPdf> {
    return this.storeCheckPdf(await this.renderer.render(data), workspaceId, checkId);
  }

  // Stores an already rendered one-check PDF (a print job renders all of its checks
  // first, so a check that cannot be drawn stops the job before anything is stored).
  async storeCheckPdf(pdfBuffer: Buffer, workspaceId: string, checkId: string): Promise<StoredPdf> {
    // Keyed by check id: check numbers repeat across bank accounts in one workspace.
    const key = path.posix.join("checks", workspaceId, `check-${checkId}-${randomUUID()}.pdf`);
    await this.storage.put(key, pdfBuffer, "application/pdf");

    return { key, sha256: sha256Hex(pdfBuffer) };
  }

  // Renders a print job of several checks (one page per sheet) and stores it like a
  // check PDF: encrypted, under its own key, with the SHA-256 for later downloads.
  async generateBatchPdf(
    sheets: CheckPdfData[][],
    workspaceId: string,
    batchId: string,
  ): Promise<StoredPdf> {
    const pdfBuffer = await this.renderer.renderSheets(sheets);
    const key = path.posix.join("checks", workspaceId, "batches", `batch-${batchId}-${randomUUID()}.pdf`);
    await this.storage.put(key, pdfBuffer, "application/pdf");
    return { key, sha256: sha256Hex(pdfBuffer) };
  }

  // Removes a stored PDF that was never recorded on a check (a lost print race).
  async deleteStoredPdf(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  // Reads a stored check PDF: decrypted (which already refuses any modified, swapped
  // or truncated file) and then checked against the SHA-256 recorded at print time.
  async readVerifiedPdf(key: string, expectedSha256: string): Promise<Buffer> {
    let buffer: Buffer;
    try {
      buffer = await this.storage.get(key);
    } catch (err) {
      if (err instanceof StorageNotFoundError) {
        throw new AppError(
          "The stored PDF for this check is missing. Void the check and reissue it.",
          410,
          "CHECK_PDF_MISSING",
        );
      }
      if (err instanceof StorageIntegrityError) throw integrityFailed();
      if (err instanceof InvalidStorageKeyError) {
        // Keys only come from our own database, so this is a server fault: logged, never detailed.
        throw new AppError(`Invalid stored PDF key: ${key}`, 500, "INVALID_STORAGE_PATH", false);
      }
      throw err;
    }

    const actual = Buffer.from(sha256Hex(buffer), "hex");
    const expected = Buffer.from(expectedSha256, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw integrityFailed();
    }

    return buffer;
  }

  // The printer calibration sheet: one page, printed 3 times. What is on it, and why, is in
  // calibration-sheet.ts.
  async generateTestPage(workspaceName: string, paperSize: PaperSize): Promise<Buffer> {
    const PDFDocument = (await import("pdfkit")).default;
    const paper = PAPER[paperSize];

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [paper.width, paper.height],
          margin: 0,
          info: {
            Title: `Printer Calibration Sheet (${paper.label})`,
            Author: "SmartBusinessSolutions",
          },
        });

        // PDFKit has no public API for ViewerPreferences; it ends this ref itself.
        (doc as unknown as { _root: { data: Record<string, unknown> } })._root.data.ViewerPreferences =
          doc.ref({ PrintScaling: "None", PickTrayByPDFSize: true });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err: Error) => reject(err));

        drawCalibrationSheet(doc, { workspaceName, paperSize, date: new Date().toISOString().split("T")[0]! });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
