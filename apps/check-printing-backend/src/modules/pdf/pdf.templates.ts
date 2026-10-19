import { PAPER } from "./pdf.types.js";
import type { CheckLayout, CheckTemplate, CutLine, PaperSize, SheetPosition, StockType, StubZone } from "./pdf.types.js";

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

// Printed in the strip below the bottom slot of three-per-page paper. A partly used
// sheet put back turned around gets the next check printed over a used one (the
// middle slot stays the middle; the bottom slot lands on the top check).
export const REUSE_NOTE =
  "REUSING THIS SHEET? Put it back exactly as it went in the first time: same side up, same end first. " +
  "Turned around, the next check prints over a used one.";
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
//   THREE_PER_PAGE  three checks of 3.5 in from the top, in slot 1, 2 or 3; no stubs;
//                   lines at 3.5, 7.0 and 10.5 in
function zonesFor(
  layout: CheckLayout,
  pageHeight: number,
  position: SheetPosition,
): { checkTop: number; stubs: StubZone[]; cutLines: CutLine[] } {
  switch (layout) {
    case "CHECK_TOP":
      return {
        checkTop: 0,
        stubs: [
          { top: 252, height: 252, label: "EMPLOYEE COPY" },
          { top: 504, height: pageHeight - 504, label: "EMPLOYER COPY" },
        ],
        cutLines: [
          { y: 252, label: "below" },
          { y: 504, label: "below" },
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
          { y: 252, label: "above" },
          { y: 504, label: "below" },
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
          { y: stubHeight, label: "below" },
          { y: checkTop, label: "above" },
        ],
      };
    }
    case "THREE_PER_PAGE": {
      // Every slot can hold a check (printed now, earlier, or later on the same sheet),
      // so the lines between slots carry no label: on either side it would land on a
      // check, possibly in its MICR clear band. The strip below the last line holds the
      // reuse note instead (see sheetNote).
      return {
        checkTop: (position - 1) * CHECK_HEIGHT,
        stubs: [],
        cutLines: [
          { y: 252, label: null },
          { y: 504, label: null },
          { y: 756, label: null },
        ],
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
    sheetNote: layout === "THREE_PER_PAGE" ? { y: 3 * CHECK_HEIGHT + 4, text: REUSE_NOTE } : null,
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

export interface SheetPlan {
  // Per check, in print order: its sheet (0-based) and slot (null: one check per sheet)
  placements: Array<{ sheet: number; position: SheetPosition | null }>;
  sheetCount: number;
  // Three-per-page: the first blank slot after the job (1 when the last sheet is full)
  nextPosition: SheetPosition | null;
}

// Where each check of a print job goes. On three-per-page paper the checks fill the
// sheet in the tray from `start` (its first blank slot) downwards, then carry on onto
// fresh sheets. Every other layout prints one check per sheet.
export function planSheets(count: number, layout: CheckLayout, start: SheetPosition = 1): SheetPlan {
  if (layout !== "THREE_PER_PAGE") {
    return {
      placements: Array.from({ length: count }, (_, i) => ({ sheet: i, position: null })),
      sheetCount: count,
      nextPosition: null,
    };
  }
  const slot = (n: number) => ((n % 3) + 1) as SheetPosition;
  const first = start - 1;
  return {
    placements: Array.from({ length: count }, (_, i) => ({ sheet: Math.floor((first + i) / 3), position: slot(first + i) })),
    sheetCount: count === 0 ? 0 : Math.floor((first + count - 1) / 3) + 1,
    nextPosition: slot(first + count),
  };
}
