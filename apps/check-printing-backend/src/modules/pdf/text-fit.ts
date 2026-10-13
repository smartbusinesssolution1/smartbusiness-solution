import PDFDocument from "pdfkit";
import { buildCheckTemplate } from "./pdf.templates.js";

// One long-lived document used only for measuring. PDFKit's standard fonts
// (Helvetica, Helvetica-Bold) ship with their metrics, so no page is needed.
let measurer: PDFKit.PDFDocument | undefined;

function getMeasurer(): PDFKit.PDFDocument {
  measurer ??= new PDFDocument({ autoFirstPage: false });
  return measurer;
}

export function textWidth(font: string, size: number, text: string): number {
  return getMeasurer().font(font).fontSize(size).widthOfString(text);
}

export interface FitSpec {
  font: string;
  maxSize: number;
  minSize: number;
  width: number;
}

export interface FitResult {
  text: string;
  size: number;
  truncated: boolean;
}

// PDFKit wraps text that measures even a hair wider than its box, so fit with a little room.
const SAFETY_PTS = 0.5;
const SIZE_STEP = 0.5;

/** Shrinks text from maxSize toward minSize until it fits; if it still does not, truncates with "…". */
export function fitText(text: string, spec: FitSpec): FitResult {
  const limit = spec.width - SAFETY_PTS;
  for (let size = spec.maxSize; size >= spec.minSize - 1e-9; size -= SIZE_STEP) {
    if (textWidth(spec.font, size, text) <= limit) {
      return { text, size, truncated: false };
    }
  }

  let cut = text;
  while (cut.length > 0 && textWidth(spec.font, spec.minSize, `${cut.trimEnd()}…`) > limit) {
    cut = cut.slice(0, -1);
  }
  return { text: `${cut.trimEnd()}…`, size: spec.minSize, truncated: true };
}

// ─── Payee: a legal name on a negotiable instrument, never truncated ───

export const PAYEE_FIT = { font: "Helvetica-Bold", maxSize: 12, minSize: 8 } as const;

// The payee box is narrowest on A4, so a name that fits there fits on every supported paper.
const NARROWEST_PAYEE_WIDTH = buildCheckTemplate("check-middle", "A4").elements.payeeName.width!;

export function payeeFitsOnCheck(payeeName: string, width = NARROWEST_PAYEE_WIDTH): boolean {
  return !fitText(payeeName, { ...PAYEE_FIT, width }).truncated;
}
