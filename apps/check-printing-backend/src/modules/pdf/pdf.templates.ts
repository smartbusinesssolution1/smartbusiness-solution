import { PAPER } from "./pdf.types.js";
import type { CheckLayout, CheckTemplate, PaperSize, StockType } from "./pdf.types.js";

/**
 * The template for a printer profile. Real checks and calibration samples both use
 * it, so a sample is laid out exactly like the checks the printer will produce.
 */
export function templateForPrinter(printer: { paperSize: PaperSize; stockType: StockType }): CheckTemplate {
  return buildCheckTemplate("check-middle", printer.paperSize, {
    tearGuides: printer.stockType === "PLAIN_PAPER",
  });
}

const SIDE_MARGIN = 36;
const CHECK_HEIGHT = 252;

/**
 * Zones follow standard 3-part voucher stock: perforations at 3.5" (252 pt)
 * and 7.0" (504 pt) from the top edge. Check face is 3.5" tall.
 *
 * Element y values are relative to the top of the check zone. Right-side
 * elements are positioned from the page's right edge, so the same layout fits
 * Letter (612 pt wide) and A4 (595.28 pt wide).
 */
export function buildCheckTemplate(
  layout: CheckLayout,
  paperSize: PaperSize,
  options: { tearGuides?: boolean } = {},
): CheckTemplate {
  const { width, height } = PAPER[paperSize];
  const right = width - SIDE_MARGIN;
  const checkTop = layout === "check-middle" ? CHECK_HEIGHT : 0;

  const zones =
    layout === "check-middle"
      ? { checkArea: { top: 252, height: CHECK_HEIGHT }, stub1: { top: 0, height: 252 }, stub2: { top: 504, height: 288 } }
      : { checkArea: { top: 0, height: CHECK_HEIGHT }, stub1: { top: 252, height: 252 }, stub2: { top: 504, height: 288 } };

  const y = (offset: number) => checkTop + offset;

  return {
    name: layout === "check-middle" ? "Check in Middle" : "Check on Top",
    paperSize,
    pageWidth: width,
    pageHeight: height,
    sideMargin: SIDE_MARGIN,
    tearGuides: options.tearGuides ?? true,
    layout,
    ...zones,
    elements: {
      companyName:    { x: SIDE_MARGIN, y: y(18), fontSize: 11 },
      companyAddress: { x: SIDE_MARGIN, y: y(32), fontSize: 7.5 },
      bankName:       { x: right - 276, y: y(18), fontSize: 9 },
      checkNumber:    { x: right - 84, y: y(16), width: 84, fontSize: 13, align: "right" },
      date:           { x: right - 186, y: y(58), width: 186, fontSize: 10 },
      payToLabel:     { x: SIDE_MARGIN, y: y(84), fontSize: 8 },
      payeeName:      { x: 105, y: y(84), width: right - 105 - 126, fontSize: 12 },
      amountBox:      { x: right - 96, y: y(82), width: 96, fontSize: 11, align: "right" },
      amountInWords:  { x: SIDE_MARGIN, y: y(112), width: right - SIDE_MARGIN, fontSize: 9 },
      memoLabel:      { x: SIDE_MARGIN, y: y(178), fontSize: 7 },
      memo:           { x: 80, y: y(178), width: 250, fontSize: 8 },
      signatureLine:  { x: right - 226, y: y(190), width: 226 },
      signature:      { x: right - 216, y: y(160), width: 206, height: 28 },
      micr:           { x: 0, y: 0, fontSize: 10 },
    },
  };
}
