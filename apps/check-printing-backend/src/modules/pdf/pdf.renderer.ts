import * as fs from "fs";
import { AppError, ValidationError } from "../../shared/errors/index.js";
import { inspectMicrFont } from "./micr-font-check.js";
import { fitText, PAYEE_FIT } from "./text-fit.js";
import type { FitResult, FitSpec } from "./text-fit.js";
import type { MicrFontReport } from "./micr-font-check.js";
import { MICR, MICR_CHARS, MICR_FIELD_END_POSITION, PTS_PER_INCH, PTS_PER_MM } from "./pdf.types.js";
import type {
  CheckPdfData,
  CheckTemplate,
  StubAreaLayout,
  VerificationPanel,
} from "./pdf.types.js";

// ═══════════════════════════════════════════════════════════════════
//  Font validation
// ═══════════════════════════════════════════════════════════════════

const TRUETYPE_MAGIC = [0x00, 0x01, 0x00, 0x00];
const OPENTYPE_MAGIC = [0x4f, 0x54, 0x54, 0x4f];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ═══════════════════════════════════════════════════════════════════
//  Typography system — font tokens
// ═══════════════════════════════════════════════════════════════════

const TYPE = {
  COMPANY_NAME:    { font: "Helvetica-Bold",  size: 11  },
  COMPANY_ADDRESS: { font: "Helvetica",       size: 7.5 },
  BANK_NAME:       { font: "Helvetica-Bold",  size: 9   },
  CHECK_NUMBER:    { font: "Helvetica-Bold",  size: 13  },
  DATE_LABEL:      { font: "Helvetica",       size: 8   },
  DATE_VALUE:      { font: "Helvetica-Bold",  size: 10  },
  PAY_LABEL:       { font: "Helvetica-Bold",  size: 8   },
  PAYEE_NAME:      { font: "Helvetica-Bold",  size: 12  },
  AMOUNT:          { font: "Helvetica-Bold",  size: 11  },
  AMOUNT_WORDS:    { font: "Helvetica",       size: 9   },
  DOLLARS:         { font: "Helvetica-Bold",  size: 9   },
  LABEL:           { font: "Helvetica",       size: 7   },
  BODY:            { font: "Helvetica",       size: 8   },
  VOID_NOTICE:     { font: "Helvetica-Bold",   size: 8   },
  MEMO_LABEL:      { font: "Helvetica-Bold",  size: 8   },
  MEMO_TEXT:        { font: "Helvetica",       size: 8   },
  SIGNATURE_LABEL: { font: "Helvetica-Bold",   size: 8   },
  STUB_HEADER:     { font: "Helvetica-Bold",  size: 9   },
  STUB_INFO:       { font: "Helvetica",       size: 7.5 },
  STUB_TABLE_HEAD: { font: "Helvetica-Bold",  size: 7   },
  STUB_TABLE_CELL: { font: "Helvetica",       size: 7   },
  STUB_LABEL:      { font: "Helvetica",       size: 6   },
} as const;

// Nothing is printed within 1/4" (6.35 mm) of a paper edge: most printers cannot
// print the outer ~4 mm, and marks there are clipped or shifted.
const EDGE_SAFE_PTS = 18;

// Helvetica and Helvetica-Bold both have an ascender of 718/1000 (Adobe font metrics).
// Used to keep shrunk text on the same baseline as full-size text.
const HELVETICA_ASCENDER = 0.718;

// ═══════════════════════════════════════════════════════════════════
//  Color palette
// ═══════════════════════════════════════════════════════════════════

const COLOR = {
  black:         "#000000",
  dark:          "#222222",
  mid:           "#555555",
  label:         "#777777",
  light:         "#AAAAAA",
  rule:          "#000000",
  ruleLight:     "#BBBBBB",
  stubHeaderBg:  "#EEEEEE",
  stubGridLine:  "#CCCCCC",
} as const;

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════

function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(CONTROL_CHARS, "").trim();
}

function addCommasIfNeeded(raw: string): string {
  if (raw.includes(",")) return raw;
  const parts = raw.split(".");
  parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// ═══════════════════════════════════════════════════════════════════
//  PdfRenderer
// ═══════════════════════════════════════════════════════════════════

export class PdfRenderer {
  private readonly fontPath: string;
  private readonly strictFont: boolean;
  private fontValidated = false;
  private fontReport?: Promise<MicrFontReport>;

  constructor(fontPath: string, options: { strictFont?: boolean } = {}) {
    this.fontPath = fontPath;
    this.strictFont = options.strictFont ?? true;
    if (fs.existsSync(fontPath)) {
      this.validateFont(fontPath);
      this.fontValidated = true;
    }
  }

  /** Runs the E-13B glyph check once and caches the result. */
  checkFont(): Promise<MicrFontReport> {
    this.fontReport ??= inspectMicrFont(this.fontPath);
    return this.fontReport;
  }

  get isStrictFont(): boolean {
    return this.strictFont;
  }

  private validateFont(path: string): void {
    const hdr = Buffer.alloc(4);
    const fd = fs.openSync(path, "r");
    fs.readSync(fd, hdr, 0, 4, 0);
    fs.closeSync(fd);
    const ok =
      TRUETYPE_MAGIC.every((b, i) => hdr[i] === b) ||
      OPENTYPE_MAGIC.every((b, i) => hdr[i] === b);
    if (!ok)
      throw new Error(
        `File at "${path}" is not a valid TrueType/OpenType font.`,
      );
  }

  async render(data: CheckPdfData): Promise<Buffer> {
    return this.renderSheets([[data]]);
  }

  // One PDF page per sheet of paper, each holding one or more checks (several only on
  // three-per-page paper, each in its own slot). A single check is a one-sheet job.
  async renderSheets(sheets: CheckPdfData[][]): Promise<Buffer> {
    const all = sheets.flat();
    const first = all[0];
    if (!first || sheets.some((sheet) => sheet.length === 0)) {
      throw new Error("Nothing to render: every sheet needs at least one check.");
    }
    // One paper and one printer correction for the whole job: it goes through one tray.
    const t0 = first.template;
    if (all.some((d) => d.template.pageWidth !== t0.pageWidth || d.template.pageHeight !== t0.pageHeight || d.template.layout !== t0.layout)) {
      throw new Error("Every check in a print job must use the same paper and layout.");
    }
    if (all.some((d) => d.horizontalOffsetPts !== first.horizontalOffsetPts || d.verticalOffsetPts !== first.verticalOffsetPts)) {
      throw new Error("Every check in a print job must use the same printer offsets.");
    }

    if (!this.fontValidated) {
      if (!fs.existsSync(this.fontPath))
        throw new Error(
          `E-13B MICR font not found at "${this.fontPath}". ` +
            "Download a licensed E-13B .ttf and place it there.",
        );
      this.validateFont(this.fontPath);
      this.fontValidated = true;
    }

    const fontReport = await this.checkFont();
    if (!fontReport.ok && this.strictFont) {
      throw new AppError(
        `Checks cannot be printed: the MICR font "${fontReport.fontName}" is not a valid E-13B font ` +
          `(${fontReport.problems.join("; ")}). Install a licensed E-13B font and set E13B_FONT_PATH.`,
        503,
        "MICR_FONT_INVALID",
      );
    }

    const PDFDocument = (await import("pdfkit")).default;
    const last = all[all.length - 1]!;

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          autoFirstPage: false,
          info: {
            Title: all.length === 1 ? `Check #${first.checkNumber}` : `Checks #${first.checkNumber} to #${last.checkNumber}`,
            Author: first.companyName,
            Creator: "SmartBusinessSolutions",
            Producer: "PDFKit",
          },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (e: Error) => reject(e));

        // PDFKit has no public API for ViewerPreferences; it ends this ref itself.
        (doc as unknown as { _root: { data: Record<string, unknown> } })._root.data.ViewerPreferences =
          doc.ref({ PrintScaling: "None", PickTrayByPDFSize: true });

        doc.registerFont("E13B", this.fontPath);

        for (const sheet of sheets) {
          doc.addPage({ size: [t0.pageWidth, t0.pageHeight], margin: 0 });

          // The printer correction is applied once, to the whole page, so every
          // element drawn below moves together and none can miss it.
          doc.save();
          doc.translate(first.horizontalOffsetPts, first.verticalOffsetPts);
          for (const data of sheet) this.drawCheck(doc, data, fontReport.fontSizePts);
          // The tear lines belong to the sheet, not to a check: drawn once per page.
          if (sheet[0]!.template.tearGuides) this.drawTearGuides(doc, sheet[0]!.template);
          doc.restore();
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // One check (with its stubs) at the place its template gives it on the page.
  private drawCheck(doc: PDFKit.PDFDocument, data: CheckPdfData, micrFontSizePts: number): void {
    const t = data.template;
    // A calibration sample is drawn by exactly the same code as a real check, so it
    // goes through the same printing path; only the watermark and lower stub differ.
    if (data.verification) this.drawSampleWatermark(doc, t);
    // Every stub the layout has (none on three-per-page paper). On a calibration
    // sample, the measuring panel takes the place of the lower stub.
    t.stubs.forEach((stub, i) => {
      const isSampleArea = data.verification && i === t.stubs.length - 1;
      if (!isSampleArea) this.drawStub(doc, data, t, stub, stub.label);
    });
    this.drawCheckFace(doc, data, t);
    this.drawMicrLine(doc, data, t, micrFontSizePts);
    if (data.verification) this.drawVerificationPanel(doc, t, t.sampleArea, data.verification);
  }

  // ─────────────────────────────────────────────────────────────
  //  CHECK FACE
  // ─────────────────────────────────────────────────────────────

  private drawCheckFace(
    doc: PDFKit.PDFDocument,
    data: CheckPdfData,
    tmpl: CheckTemplate,
  ): void {
    const el = tmpl.elements;
    const R = tmpl.pageWidth - tmpl.sideMargin;

    // ────────────────────────────────────────────────────────
    //  ROW 1 — Company · Bank · Check #
    // ────────────────────────────────────────────────────────

    // Company block: name and address must stop before the bank name begins.
    const companyWidth = el.bankName.x - el.companyName.x - 10;
    this.drawFitted(doc, sanitize(data.companyName), el.companyName.x, el.companyName.y, {
      font: TYPE.COMPANY_NAME.font, maxSize: TYPE.COMPANY_NAME.size, minSize: 8, width: companyWidth,
    }, COLOR.black);

    const addrX = el.companyAddress.x;
    const addrY = el.companyAddress.y;
    const addressSpec: FitSpec = {
      font: TYPE.COMPANY_ADDRESS.font, maxSize: TYPE.COMPANY_ADDRESS.size, minSize: 6.5, width: companyWidth,
    };
    this.drawFitted(doc, sanitize(data.companyAddress), addrX, addrY, addressSpec, COLOR.dark);
    this.drawFitted(doc, sanitize(data.companyCityStateZip), addrX, addrY + 10, addressSpec, COLOR.dark);

    // Bank name: must stop before the check number column.
    this.drawFitted(doc, sanitize(data.bankName), el.bankName.x, el.bankName.y, {
      font: TYPE.BANK_NAME.font, maxSize: TYPE.BANK_NAME.size, minSize: 7, width: el.checkNumber.x - el.bankName.x - 8,
    }, COLOR.dark);

    // Check number (proportionally balanced, top-right)
    doc
      .font(TYPE.CHECK_NUMBER.font)
      .fontSize(TYPE.CHECK_NUMBER.size)
      .fillColor(COLOR.black)
      .text(data.checkNumber, el.checkNumber.x, el.checkNumber.y, {
        width: el.checkNumber.width,
        align: "right",
      });

    // ────────────────────────────────────────────────────────
    //  ROW 2 — DATE
    // ────────────────────────────────────────────────────────

    const dateY = el.date.y;
    const dateLabelX = el.date.x;

    // DATE label
    doc
      .font(TYPE.DATE_LABEL.font)
      .fontSize(TYPE.DATE_LABEL.size)
      .fillColor(COLOR.mid)
      .text("DATE", dateLabelX, dateY + 2);

    // Date value (bold)
    const dateValueX = dateLabelX + 34;
    doc
      .font(TYPE.DATE_VALUE.font)
      .fontSize(TYPE.DATE_VALUE.size)
      .fillColor(COLOR.black)
      .text(data.checkDate, dateValueX, dateY);

    // Date underline
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.5)
      .moveTo(dateValueX - 2, dateY + 13)
      .lineTo(R, dateY + 13)
      .stroke();

    // ────────────────────────────────────────────────────────
    //  ROW 3 — PAY TO THE ORDER OF · Payee · $ Amount
    //  (extra vertical breathing space around this row)
    // ────────────────────────────────────────────────────────

    const payY = el.payToLabel.y;

    // "PAY TO THE / ORDER OF" (stacked label)
    doc
      .font(TYPE.PAY_LABEL.font)
      .fontSize(TYPE.PAY_LABEL.size)
      .fillColor(COLOR.mid)
      .text("PAY TO THE", el.payToLabel.x, payY)
      .text("ORDER OF", el.payToLabel.x, payY + 10);

    // Payee name (dominant element)
    const payeeX = el.payeeName.x;
    const payeeY = el.payeeName.y;

    // The payee is a legal name: it may shrink but is never truncated. Check creation
    // already rejects names that cannot fit; this catches checks created before that rule.
    const payeeFit = fitText(sanitize(data.payeeName), { ...PAYEE_FIT, width: el.payeeName.width! });
    if (payeeFit.truncated) {
      throw new ValidationError("This check cannot be printed: the payee name is too long to fit on the check.", {
        payeeName: ["Edit the check and shorten or abbreviate the payee name."],
      });
    }
    this.drawFitted(doc, sanitize(data.payeeName), payeeX, payeeY + 1, {
      ...PAYEE_FIT, width: el.payeeName.width!,
    }, COLOR.black);

    // Payee underline — extends from payee start to just before the $ sign
    const payeeLineY = payeeY + 17;
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.75)
      .moveTo(payeeX - 4, payeeLineY)
      .lineTo(el.amountBox.x - 8, payeeLineY)
      .stroke();

    // "$" sign (separate from box)
    const boxX = el.amountBox.x;
    const boxY = el.amountBox.y;
    const boxW = el.amountBox.width ?? 96;
    const boxH = 18;

    doc
      .font(TYPE.AMOUNT.font)
      .fontSize(12)
      .fillColor(COLOR.black)
      .text("$", boxX - 14, boxY + 3);

    // Amount box (thin authentic border)
    doc
      .strokeColor(COLOR.black)
      .lineWidth(0.75)
      .rect(boxX, boxY, boxW, boxH)
      .stroke();

    // Amount value inside box
    doc
      .font(TYPE.AMOUNT.font)
      .fontSize(TYPE.AMOUNT.size)
      .text(`**${addCommasIfNeeded(data.amount)}`, boxX + 3, boxY + 4, {
        width: boxW - 6,
        align: "right",
        lineBreak: false,
      });

    // ────────────────────────────────────────────────────────
    //  ROW 4 — Amount in Words
    //  Single underline, no box. DOLLARS far-right.
    // ────────────────────────────────────────────────────────

    const wordsX = el.amountInWords.x;
    const wordsY = el.amountInWords.y;

    // Measure DOLLARS so the star line extends right up to it
    doc.font(TYPE.DOLLARS.font).fontSize(TYPE.DOLLARS.size);
    const dollarsW = doc.widthOfString("DOLLARS");
    const wordsLineW = R - wordsX - dollarsW - 2;

    // Fill stars dynamically to span the full line width
    doc.font(TYPE.AMOUNT_WORDS.font).fontSize(TYPE.AMOUNT_WORDS.size);
    const baseText = data.amountInWords;
    const baseW = doc.widthOfString(baseText + " ");
    const starW = doc.widthOfString("*");
    const starCount = Math.max(3, Math.floor((wordsLineW - baseW) / starW));
    const stars = " " + "*".repeat(starCount);

    doc
      .fillColor(COLOR.black)
      .text(baseText + stars, wordsX, wordsY, {
        width: wordsLineW,
        lineBreak: false,
      });

    // Underline beneath the words
    const wordsLineY = wordsY + 12;
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.5)
      .moveTo(wordsX, wordsLineY)
      .lineTo(wordsX + wordsLineW, wordsLineY)
      .stroke();

    // "DOLLARS" on the same baseline, tight against the line end
    doc
      .font(TYPE.DOLLARS.font)
      .fontSize(TYPE.DOLLARS.size)
      .fillColor(COLOR.black)
      .text("DOLLARS", wordsX + wordsLineW + 2, wordsY);

    // ────────────────────────────────────────────────────────
    //  VOID AFTER 90 DAYS — right-aligned beneath amount area
    // ────────────────────────────────────────────────────────

    const voidX = el.amountBox.x - 50;
    const voidW = R - voidX;
    doc
      .font(TYPE.VOID_NOTICE.font)
      .fontSize(TYPE.VOID_NOTICE.size)
      .fillColor(COLOR.label)
      .text("VOID AFTER 90 DAYS", voidX, tmpl.checkArea.top + 130, {
        width: voidW,
        align: "center",
      });

    // ────────────────────────────────────────────────────────
    //  ROW 5 — Memo · Signature
    //  Horizontally balanced: memo left half, sig right half
    // ────────────────────────────────────────────────────────

    const memoY = el.memoLabel.y;

    // MEMO label
    doc
      .font(TYPE.MEMO_LABEL.font)
      .fontSize(TYPE.MEMO_LABEL.size)
      .fillColor(COLOR.dark)
      .text("MEMO", el.memoLabel.x, memoY + 1);

    // Memo text
    const memoTextX = el.memo.x;
    // The memo is informational, so it may be truncated; it must stop before the signature line.
    if (data.memo) {
      this.drawFitted(doc, sanitize(data.memo), memoTextX, memoY, {
        font: TYPE.MEMO_TEXT.font,
        maxSize: TYPE.MEMO_TEXT.size,
        minSize: 6.5,
        width: Math.min(el.memo.width ?? 250, el.signatureLine.x - memoTextX - 10),
      }, COLOR.black);
    }

    // Memo underline (wider — extends to center of check)
    const memoLineY = memoY + 12;
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.5)
      .moveTo(memoTextX, memoLineY)
      .lineTo(memoTextX + (el.memo.width ?? 250), memoLineY)
      .stroke();

    // Signature line (extended, aligned right edge to match amount box)
    const sigX = el.signatureLine.x;
    const sigY = el.signatureLine.y;
    const sigW = el.signatureLine.width ?? 226;

    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.5)
      .moveTo(sigX, sigY)
      .lineTo(sigX + sigW, sigY)
      .stroke();

    // "AUTHORIZED SIGNATURE" (below line, right-aligned)
    doc
      .font(TYPE.SIGNATURE_LABEL.font)
      .fontSize(TYPE.SIGNATURE_LABEL.size)
      .fillColor(COLOR.light)
      .text("AUTHORIZED SIGNATURE", sigX, sigY + 3, {
        width: sigW,
        align: "right",
      });

    // Signature image. A bank account with a signature must never produce an
    // unsigned check by accident, so a missing or unreadable image stops the print.
    if (data.signatureImage) {
      try {
        doc.image(
          data.signatureImage,
          el.signature.x,
          el.signature.y,
          { fit: [el.signature.width, el.signature.height] },
        );
      } catch {
        throw new AppError(
          "The signature image for this bank account is missing or unreadable, so the check was not printed. Upload the signature again.",
          422,
          "SIGNATURE_IMAGE_UNAVAILABLE",
        );
      }
    }
  }

  /**
   * Draws single-line text that fits its box: shrinks toward spec.minSize, then
   * truncates with "…". `y` is the top of the line at full size; the baseline stays
   * where full-size text would sit, so shrunk text does not drift off its line.
   */
  private drawFitted(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    spec: FitSpec,
    color: string,
  ): FitResult {
    const fit = fitText(text, spec);
    doc
      .font(spec.font)
      .fontSize(fit.size)
      .fillColor(color)
      .text(fit.text, x, y + HELVETICA_ASCENDER * spec.maxSize, {
        width: spec.width,
        lineBreak: false,
        baseline: "alphabetic",
      });
    return fit;
  }

  // ─────────────────────────────────────────────────────────────
  //  VERIFICATION SAMPLE — watermark and measurement panel
  // ─────────────────────────────────────────────────────────────

  private drawSampleWatermark(doc: PDFKit.PDFDocument, tmpl: CheckTemplate): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#E4E4E4")
      .text("VOID  ·  CALIBRATION SAMPLE", tmpl.sideMargin, tmpl.checkArea.top + 140, {
        width: tmpl.pageWidth - 2 * tmpl.sideMargin,
        align: "center",
        lineBreak: false,
      });
  }

  private drawVerificationPanel(
    doc: PDFKit.PDFDocument,
    tmpl: CheckTemplate,
    zone: StubAreaLayout,
    panel: VerificationPanel,
  ): void {
    const L = tmpl.sideMargin;
    const W = tmpl.pageWidth - 2 * tmpl.sideMargin;
    let y = zone.top + 16;

    this.drawFitted(doc, `PRINTER VERIFICATION SAMPLE  ·  ${panel.profileName}`, L, y, {
      font: "Helvetica-Bold", maxSize: 10, minSize: 7, width: W,
    }, COLOR.black);
    y += 15;
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.dark).text(
      `Printed on ${panel.paperLabel} at 100%. With a steel ruler, measure each distance below and enter it in this printer profile's verification. ` +
        `Each value must be within 1.6 mm (1/16") of the expected value.`,
      L, y, { width: W },
    );
    y += 26;

    const cols = [
      { label: "MEASURE", w: 0.4 },
      { label: "FROM", w: 0.2 },
      { label: "EXPECTED", w: 0.22 },
      { label: "YOURS", w: 0.18 },
    ];
    const rowH = 16;
    doc.fillColor(COLOR.stubHeaderBg).rect(L, y, W, rowH).fill();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLOR.dark);
    let x = L;
    for (const c of cols) {
      doc.text(c.label, x + 5, y + 5, { lineBreak: false });
      x += c.w * W;
    }
    y += rowH;

    for (const row of panel.rows) {
      const mm = row.expectedPts / PTS_PER_MM;
      const inches = row.expectedPts / PTS_PER_INCH;
      x = L;
      this.drawFitted(doc, row.label, x + 5, y + 4, {
        font: "Helvetica-Bold", maxSize: 8, minSize: 6.5, width: cols[0]!.w * W - 10,
      }, COLOR.black);
      x += cols[0]!.w * W;
      this.drawFitted(doc, row.from, x + 5, y + 4, {
        font: "Helvetica", maxSize: 8, minSize: 6.5, width: cols[1]!.w * W - 10,
      }, COLOR.dark);
      x += cols[1]!.w * W;
      doc.font("Helvetica").fontSize(8).fillColor(COLOR.black)
        .text(`${mm.toFixed(1)} mm  (${inches.toFixed(3)}")`, x + 5, y + 4, { lineBreak: false });
      x += cols[2]!.w * W;
      doc.strokeColor(COLOR.light).lineWidth(0.5).moveTo(x + 5, y + 13).lineTo(L + W - 6, y + 13).stroke();
      y += rowH;
      doc.strokeColor(COLOR.stubGridLine).lineWidth(0.25).moveTo(L, y).lineTo(L + W, y).stroke();
    }
    doc.strokeColor(COLOR.stubGridLine).lineWidth(0.5).rect(L, y - rowH * (panel.rows.length + 1), W, rowH * (panel.rows.length + 1)).stroke();
  }

  // ─────────────────────────────────────────────────────────────
  //  TEAR GUIDES — dashed line + label at each zone boundary
  //
  //  The label always sits on the stub side of the line, never on
  //  the check: the bottom 5/8" of the check is the MICR clear band,
  //  where nothing but MICR characters may print. Between two slots
  //  of three-per-page paper there is no such side: no label there.
  // ─────────────────────────────────────────────────────────────

  private drawTearGuides(doc: PDFKit.PDFDocument, tmpl: CheckTemplate): void {
    for (const line of tmpl.cutLines) {
      this.drawTearGuide(doc, tmpl, line.y, line.label);
    }
  }

  private drawTearGuide(
    doc: PDFKit.PDFDocument,
    tmpl: CheckTemplate,
    y: number,
    label: "above" | "below" | null,
  ): void {
    const left = EDGE_SAFE_PTS;
    const right = tmpl.pageWidth - EDGE_SAFE_PTS;

    // Dash pattern is graphics state: set it, build and stroke the path, then reset it.
    doc.strokeColor(COLOR.ruleLight).lineWidth(0.4).dash(1.5, { space: 3 });
    doc.moveTo(left, y).lineTo(right, y).stroke();
    doc.undash();

    if (!label) return;
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor("#666666")
      .text("TEAR ALONG PERFORATION", left, label === "above" ? y - 10 : y + 3, {
        width: right - left,
        align: "center",
        lineBreak: false,
      });
  }

  // ─────────────────────────────────────────────────────────────
  //  MICR LINE — ABA standard E-13B
  //
  //  Fields sit at fixed character positions counted from the
  //  right edge (position 1 is 5/16" in, 0.125" per position):
  //    ⑈Check#⑈ ends at 45 · ⑆Routing⑆ ends at 33 · Account⑈ ends at 14
  //  Bottom of characters: 3/16" above the check's bottom edge,
  //  inside the 5/8" clear band. Positions 1–12 stay blank for the bank.
  // ─────────────────────────────────────────────────────────────

  private drawMicrLine(
    doc: PDFKit.PDFDocument,
    data: CheckPdfData,
    tmpl: CheckTemplate,
    fontSizePts: number,
  ): void {
    const checkBottom = tmpl.checkArea.top + tmpl.checkArea.height;
    const baselineY = checkBottom - MICR.baselineFromBottomIn * PTS_PER_INCH;
    const position1Right = tmpl.pageWidth - MICR.position1RightIn * PTS_PER_INCH;

    doc.font("E13B").fontSize(fontSizePts).fillColor(COLOR.black);

    const drawField = (text: string, endPosition: number) => {
      const right = position1Right - (endPosition - 1) * MICR.pitchPts;
      doc.text(text, right - text.length * MICR.pitchPts, baselineY, {
        baseline: "alphabetic",
        lineBreak: false,
      });
    };

    const { transit: T, onUs: O } = MICR_CHARS;
    drawField(`${O}${data.checkNumber}${O}`, MICR_FIELD_END_POSITION.auxOnUs);
    drawField(`${T}${data.routingNumber}${T}`, MICR_FIELD_END_POSITION.transit);
    drawField(`${data.accountNumber}${O}`, MICR_FIELD_END_POSITION.onUs);
  }

  // ─────────────────────────────────────────────────────────────
  //  STUB — accounting-software style
  //
  //  Header:  Company Name ·····················  Check #
  //  Info:    DATE · PAYEE · CHECK TOTAL
  //  Label:                          EMPLOYEE / EMPLOYER COPY
  //  ──────────────────────────────────────────────────────────
  //  Account  │  Amount  │  Memo            │  Class
  //  ─────────┼──────────┼──────────────────┼─────────
  //           │  $x,xxx  │  description     │
  // ─────────────────────────────────────────────────────────────

  private drawStub(
    doc: PDFKit.PDFDocument,
    data: CheckPdfData,
    tmpl: CheckTemplate,
    stub: StubAreaLayout,
    label: string,
  ): void {
    const L = tmpl.sideMargin;
    const R = tmpl.pageWidth - tmpl.sideMargin;
    const W = R - L;
    // A stub touching the page's top or bottom edge keeps its content clear of the
    // printer's non-printable margin (about 4 mm on most lasers).
    const topPadding = stub.top === 0 ? 24 : 12;
    const touchesBottomEdge = stub.top + stub.height > tmpl.pageHeight - EDGE_SAFE_PTS;
    const contentBottom = stub.top + stub.height - (touchesBottomEdge ? 24 : 16);
    let y = stub.top + topPadding;

    // ── Header row ──

    this.drawFitted(doc, sanitize(data.companyName), L, y, {
      font: TYPE.STUB_HEADER.font, maxSize: TYPE.STUB_HEADER.size, minSize: 7, width: W - 80,
    }, COLOR.black);
    doc
      .font(TYPE.STUB_HEADER.font)
      .fontSize(TYPE.STUB_HEADER.size)
      .text(data.checkNumber, L, y, { width: W, align: "right" });

    y += 14;

    // ── Info row: DATE · PAYEE · CHECK TOTAL, each kept inside its column ──

    doc
      .font(TYPE.STUB_INFO.font)
      .fontSize(TYPE.STUB_INFO.size)
      .fillColor(COLOR.dark);

    doc.text(`DATE: ${data.checkDate}`, L, y);
    this.drawFitted(doc, `PAYEE: ${sanitize(data.payeeName)}`, L + 120, y, {
      font: TYPE.STUB_INFO.font, maxSize: TYPE.STUB_INFO.size, minSize: 6, width: 202,
    }, COLOR.dark);
    doc
      .font(TYPE.STUB_INFO.font)
      .fontSize(TYPE.STUB_INFO.size)
      .text(`CHECK TOTAL: $ ${addCommasIfNeeded(data.amount)}`, L + 330, y);

    y += 12;

    // ── Copy label ──

    doc
      .font(TYPE.STUB_LABEL.font)
      .fontSize(TYPE.STUB_LABEL.size)
      .fillColor(COLOR.light)
      .text(label, L, y, { width: W, align: "right" });

    y += 10;

    // Light separator between info and table
    doc
      .strokeColor(COLOR.stubGridLine)
      .lineWidth(0.5)
      .moveTo(L, y - 2)
      .lineTo(R, y - 2)
      .stroke();

    // ── Table ──

    const cols = [
      { label: "Account", x: L, w: 160 },
      { label: "Amount",  x: L + 160, w: 100 },
      { label: "Memo",    x: L + 260, w: 190 },
      { label: "Class",   x: L + 450, w: W - 450 },
    ];
    const headerH = 14;
    const rowH = 13;

    // Header background
    doc.fillColor(COLOR.stubHeaderBg).rect(L, y, W, headerH).fill();

    // Header text
    doc
      .font(TYPE.STUB_TABLE_HEAD.font)
      .fontSize(TYPE.STUB_TABLE_HEAD.size)
      .fillColor(COLOR.dark);

    for (const col of cols) {
      doc.text(col.label, col.x + 4, y + 4, { width: col.w - 8 });
    }

    // Header bottom border
    doc.strokeColor(COLOR.stubGridLine).lineWidth(0.5);
    doc.moveTo(L, y + headerH).lineTo(R, y + headerH).stroke();

    // Column dividers through header
    for (let i = 1; i < cols.length; i++) {
      doc.moveTo(cols[i]!.x, y).lineTo(cols[i]!.x, y + headerH).stroke();
    }

    y += headerH;

    // ── Data rows ──

    const maxRows = Math.floor((contentBottom - y) / rowH);

    const drawRow = (amount: string, memo: string) => {
      // Bottom border
      doc
        .strokeColor(COLOR.stubGridLine)
        .lineWidth(0.25)
        .moveTo(L, y + rowH)
        .lineTo(R, y + rowH)
        .stroke();

      // Column dividers
      for (let i = 1; i < cols.length; i++) {
        doc
          .strokeColor(COLOR.stubGridLine)
          .lineWidth(0.25)
          .moveTo(cols[i]!.x, y)
          .lineTo(cols[i]!.x, y + rowH)
          .stroke();
      }

      // Cell data: one line per row, so long descriptions never spill into the next row.
      const cellSpec = (col: { w: number }): FitSpec => ({
        font: TYPE.STUB_TABLE_CELL.font, maxSize: TYPE.STUB_TABLE_CELL.size, minSize: 6, width: col.w - 8,
      });
      this.drawFitted(doc, amount, cols[1]!.x + 4, y + 3, cellSpec(cols[1]!), COLOR.dark);
      this.drawFitted(doc, memo, cols[2]!.x + 4, y + 3, cellSpec(cols[2]!), COLOR.dark);
      y += rowH;
    };

    if (data.invoiceItems && data.invoiceItems.length > 0) {
      for (const item of data.invoiceItems.slice(0, maxRows)) {
        drawRow(
          `$${addCommasIfNeeded(item.amount)}`,
          sanitize(item.description),
        );
      }
    } else {
      drawRow(
        `$${addCommasIfNeeded(data.amount)}`,
        data.memo ? sanitize(data.memo) : "",
      );
    }
  }
}
