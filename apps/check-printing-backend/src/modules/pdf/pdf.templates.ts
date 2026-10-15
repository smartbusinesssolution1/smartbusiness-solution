import { PAPER } from "./pdf.types.js";
import type { CheckLayout, CheckTemplate, PaperSize, SheetPosition, StockType } from "./pdf.types.js";

/**
 * The template for a printer profile. Real checks and calibration samples both use
 * it, so a sample is laid out exactly like the checks the printer will produce.
 */
export function templateForPrinter(printer: {
  paperSize: PaperSize;
  stockType: StockType;
  layout: CheckLayout;
  position?: SheetPosition;
}): CheckTemplate {
  return buildCheckTemplate(printer.layout, printer.paperSize, {
    tearGuides: printer.stockType === "PLAIN_PAPER",
    position: printer.position,
  });
}

const SIDE_MARGIN = 36;
const CHECK_HEIGHT = 252; // 3.5 in: every layout, every slot

const LAYOUT_NAMES: Record<CheckLayout, string> = {
  CHECK_TOP: "Check on Top",
  CHECK_MIDDLE: "Check in Middle",
  CHECK_BOTTOM: "Check on Bottom",
  THREE_PER_PAGE: "Three per Page",
};

// Where the check, the stubs and the tear lines go for each layout. Only the
// vertical placement differs: the check is always 3.5 in tall, and everything on it
// (MICR line included) is placed relative to the check's own top and bottom edges.
//
//   CHECK_TOP       check 0–3.5 in, stubs below, lines at 3.5 and 7.0 in
//   CHECK_MIDDLE    stub, check 3.5–7.0 in, stub, lines at 3.5 and 7.0 in
//   CHECK_BOTTOM    two stubs, check on the bottom 3.5 in of the sheet
//   THREE_PER_PAGE  three checks of 3.5 in from the top, in slot 1, 2 or 3; no stubs
function zonesFor(layout: CheckLayout, pageHeight: number, position: SheetPosition) {
  switch (layout) {
    case "CHECK_TOP":
      return {
        checkTop: 0,
        stubs: [
          { top: 252, height: 252, label: "EMPLOYEE COPY" },
          { top: 504, height: pageHeight - 504, label: "EMPLOYER COPY" },
        ],
        cutLines: [
          { y: 252, labelAbove: false },
          { y: 504, labelAbove: false },
        ],
      };
    case "CHECK_MIDDLE":
      return {
        checkTop: 252,
        stubs: [
          { top: 0, height: 252, label: "EMPLOYEE COPY" },
          { top: 504, height: pageHeight - 504, label: "EMPLOYER COPY" },
        ],
        cutLines: [
          { y: 252, labelAbove: true },
          { y: 504, labelAbove: false },
        ],
      };
    case "CHECK_BOTTOM": {
      const checkTop = pageHeight - CHECK_HEIGHT;
      const stubHeight = checkTop / 2;
      return {
        checkTop,
        stubs: [
          { top: 0, height: stubHeight, label: "EMPLOYEE COPY" },
          { top: stubHeight, height: stubHeight, label: "EMPLOYER COPY" },
        ],
        cutLines: [
          { y: stubHeight, labelAbove: false },
          { y: checkTop, labelAbove: true },
        ],
      };
    }
    case "THREE_PER_PAGE": {
      const checkTop = (position - 1) * CHECK_HEIGHT;
      const checkBottom = checkTop + CHECK_HEIGHT;
      return {
        checkTop,
        stubs: [],
        cutLines: [252, 504, 756].map((y) => ({
          y,
          // Never on the printed check: above its top line, below its bottom line.
          labelAbove: y === checkTop ? true : y === checkBottom ? false : y < checkTop,
        })),
      };
    }
  }
}

// Zones follow standard voucher stock (lines at 3.5 in and 7.0 in) and three-per-page
// stock (lines every 3.5 in). Element y values are relative to the top of the check;
// right-side elements are positioned from the page's right edge, so the same layout
// fits Letter (612 pt wide) and A4 (595.28 pt wide).
export function buildCheckTemplate(
  layout: CheckLayout,
  paperSize: PaperSize,
  options: { tearGuides?: boolean; position?: SheetPosition } = {},
): CheckTemplate {
  const { width, height } = PAPER[paperSize];
  const right = width - SIDE_MARGIN;
  const position: SheetPosition = layout === "THREE_PER_PAGE" ? (options.position ?? 1) : 1;
  const { checkTop, stubs, cutLines } = zonesFor(layout, height, position);

  // A calibration sample's measuring panel goes in the lower stub, or on three-per-page
  // paper in the slot below the check (above it when the check is in slot 3).
  const sampleArea =
    stubs.length > 0
      ? { top: stubs[stubs.length - 1]!.top, height: stubs[stubs.length - 1]!.height }
      : { top: position === 3 ? 252 : checkTop + CHECK_HEIGHT, height: CHECK_HEIGHT };

  const y = (offset: number) => checkTop + offset;

  return {
    name: LAYOUT_NAMES[layout],
    paperSize,
    pageWidth: width,
    pageHeight: height,
    sideMargin: SIDE_MARGIN,
    tearGuides: options.tearGuides ?? true,
    layout,
    position,
    checkArea: { top: checkTop, height: CHECK_HEIGHT },
    stubs,
    cutLines,
    sampleArea,
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
