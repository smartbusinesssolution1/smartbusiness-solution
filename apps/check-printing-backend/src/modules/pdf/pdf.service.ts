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
import { CALIBRATION_REF, PAPER, PTS_PER_INCH } from "./pdf.types.js";

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

const MM_PER_INCH = 25.4;
// ISO/IEC 7810 ID-1: every bank card is exactly 85.60 mm wide.
const BANK_CARD_WIDTH_MM = 85.6;

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

  /**
   * Calibration sheet v2.
   *
   * Four reference lines: X1 and X2 are measured from the LEFT paper edge,
   * Y1 and Y2 from the TOP paper edge (the edges a printer registers each
   * sheet against). Two lines per axis let the server detect scaling.
   * Nothing on this page is a ruler: anything printed shifts with the very
   * error being measured, so users must measure with a physical ruler.
   */
  async generateTestPage(workspaceName: string, paperSize: PaperSize): Promise<Buffer> {
    const PDFDocument = (await import("pdfkit")).default;
    const paper = PAPER[paperSize];
    const ref = CALIBRATION_REF[paperSize];

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

        const W = paper.width;
        const X1 = ref.x1 * PTS_PER_INCH;
        const X2 = ref.x2 * PTS_PER_INCH;
        const Y1 = ref.y1 * PTS_PER_INCH;
        const Y2 = ref.y2 * PTS_PER_INCH;

        const inches = (v: number) => `${v.toFixed(3)} in`;
        const mm = (v: number) => `${(v * MM_PER_INCH).toFixed(2)} mm`;

        // ── Header (above line Y1) ──
        doc.font("Helvetica-Bold").fontSize(15).fillColor("#000000");
        doc.text("PRINTER CALIBRATION SHEET", 0, 24, { width: W, align: "center" });
        doc.font("Helvetica").fontSize(8.5).fillColor("#444444");
        doc.text(`${workspaceName}  ·  ${paper.label}  ·  method v${CALIBRATION_REF.version}`, 0, 44, {
          width: W,
          align: "center",
        });

        // ── Reference lines. Spans are chosen so no two lines cross. ──
        doc.strokeColor("#000000").lineWidth(0.75);
        doc.moveTo(X1, Y1 + 18).lineTo(X1, Y2 - 18).stroke();
        doc.moveTo(X2, Y1 + 18).lineTo(X2, Y2 - 18).stroke();
        doc.moveTo(X1 + 18, Y1).lineTo(X2 - 18, Y1).stroke();
        doc.moveTo(X1 + 18, Y2).lineTo(X2 - 18, Y2).stroke();

        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
        const verticalLabel = (x: number, label: string) => {
          doc.save();
          doc.translate(x + 3, Y2 - 30);
          doc.rotate(-90);
          doc.text(label, 0, 0, { lineBreak: false });
          doc.restore();
        };
        verticalLabel(X1, `X1  ·  from LEFT edge  ·  ${inches(ref.x1)}  (${mm(ref.x1)})`);
        verticalLabel(X2, `X2  ·  from LEFT edge  ·  ${inches(ref.x2)}  (${mm(ref.x2)})`);
        doc.text(`Y1  ·  from TOP edge  ·  ${inches(ref.y1)}  (${mm(ref.y1)})`, X1 + 18, Y1 - 11, { lineBreak: false });
        doc.text(`Y2  ·  from TOP edge  ·  ${inches(ref.y2)}  (${mm(ref.y2)})`, X1 + 18, Y2 - 11, { lineBreak: false });

        // ── Content, kept between the lines ──
        const L = X1 + 28;
        const CW = X2 - 28 - L;
        let y = Y1 + 22;

        doc.fillColor("#CC0000").rect(L, y, CW, 28).fill();
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF");
        doc.text("PRINT AT ACTUAL SIZE (100%)", L, y + 8, { width: CW, align: "center" });
        y += 36;

        const settingsText =
          "Turn OFF: Fit to page, Fit to printable area, Shrink oversized pages, Borderless printing. " +
          `Scale must be 100% (Chrome/Edge: Scale = Default). Paper: ${paper.label}.`;
        doc.font("Helvetica").fontSize(8.5);
        const settingsH = doc.heightOfString(settingsText, { width: CW - 16 });
        doc.fillColor("#FFF5F5").rect(L, y, CW, settingsH + 12).fill();
        doc.strokeColor("#CC0000").lineWidth(0.75).rect(L, y, CW, settingsH + 12).stroke();
        doc.fillColor("#660000").text(settingsText, L + 8, y + 6, { width: CW - 16 });
        y += settingsH + 24;

        doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#000000");
        doc.text("HOW TO MEASURE", L, y);
        y += 16;

        const steps = [
          "Load the same paper and tray you use for checks, then print this page at Actual Size (100%).",
          "Use a physical steel ruler. Do not use anything printed by the printer: it moves with the error you are measuring.",
          "Measure from the LEFT edge of the paper to the centre of lines X1 and X2.",
          "Measure from the TOP edge of the paper (the edge that entered the printer first) to the centre of lines Y1 and Y2.",
          "Enter all four values, in millimetres or inches, in this printer's profile. The system checks the print scale and calculates the offsets.",
        ];
        doc.font("Helvetica").fontSize(8.5);
        steps.forEach((text, i) => {
          doc.fillColor("#0055CC").circle(L + 7, y + 5, 7).fill();
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF");
          doc.text(String(i + 1), L + 4.5, y + 1.5, { lineBreak: false });
          doc.font("Helvetica").fontSize(8.5).fillColor("#222222");
          doc.text(text, L + 20, y, { width: CW - 20 });
          y += Math.max(16, doc.heightOfString(text, { width: CW - 20 }) + 6);
        });
        y += 8;

        // ── Measurement table ──
        const cols = [
          { label: "LINE", w: 0.12 },
          { label: "MEASURE FROM", w: 0.26 },
          { label: "EXPECTED", w: 0.34 },
          { label: "YOUR MEASUREMENT", w: 0.28 },
        ];
        const rowH = 18;
        let cx = L;
        doc.fillColor("#EEF3F8").rect(L, y, CW, rowH).fill();
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#333333");
        for (const c of cols) {
          doc.text(c.label, cx + 6, y + 6, { lineBreak: false });
          cx += c.w * CW;
        }
        y += rowH;
        const rows: Array<[string, string, number]> = [
          ["X1", "LEFT edge", ref.x1],
          ["X2", "LEFT edge", ref.x2],
          ["Y1", "TOP edge", ref.y1],
          ["Y2", "TOP edge", ref.y2],
        ];
        for (const [line, from, expected] of rows) {
          cx = L;
          doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
          doc.text(line, cx + 6, y + 5, { lineBreak: false });
          cx += cols[0]!.w * CW;
          doc.font("Helvetica").fontSize(8.5);
          doc.text(from, cx + 6, y + 5, { lineBreak: false });
          cx += cols[1]!.w * CW;
          doc.text(`${inches(expected)}  =  ${mm(expected)}`, cx + 6, y + 5, { lineBreak: false });
          cx += cols[2]!.w * CW;
          doc.strokeColor("#999999").lineWidth(0.5).moveTo(cx + 6, y + 14).lineTo(L + CW - 6, y + 14).stroke();
          y += rowH;
          doc.strokeColor("#DDDDDD").lineWidth(0.5).moveTo(L, y).lineTo(L + CW, y).stroke();
        }
        doc.strokeColor("#BBBBBB").lineWidth(0.75).rect(L, y - rowH * 5, CW, rowH * 5).stroke();
        y += 18;

        // ── Ruler-free scale check ──
        const barW = (BANK_CARD_WIDTH_MM / MM_PER_INCH) * PTS_PER_INCH;
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
        doc.text("SCALE CHECK (no ruler needed)", L, y);
        y += 14;
        doc.font("Helvetica").fontSize(8.5).fillColor("#222222");
        const scaleText =
          "Lay any bank or credit card along this bar. At 100% the bar is exactly 85.60 mm, the width of the card. " +
          "If the bar is visibly shorter, the page was scaled: fix the print settings and print again.";
        doc.text(scaleText, L, y, { width: CW });
        y += doc.heightOfString(scaleText, { width: CW }) + 8;
        doc.fillColor("#000000").rect(L, y, barW, 5).fill();
        doc.strokeColor("#000000").lineWidth(0.75);
        doc.moveTo(L, y - 5).lineTo(L, y + 10).stroke();
        doc.moveTo(L + barW, y - 5).lineTo(L + barW, y + 10).stroke();
        doc.font("Helvetica").fontSize(7).fillColor("#444444");
        doc.text("85.60 mm", L + barW + 6, y - 1, { lineBreak: false });

        // ── Footer (below line Y2) ──
        doc.font("Helvetica").fontSize(6.5).fillColor("#888888");
        doc.text(
          `SmartBusinessSolutions  ·  Calibration sheet v${CALIBRATION_REF.version}  ·  ${new Date().toISOString().split("T")[0]}  ·  ${paper.label}`,
          0,
          Y2 + 16,
          { width: W, align: "center" },
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
