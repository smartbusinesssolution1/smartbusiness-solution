import { CALIBRATION_REF, PAPER, PTS_PER_INCH } from "./pdf.types.js";
import type { PaperSize } from "./pdf.types.js";

// ═══════════════════════════════════════════════════════════════
// THE PRINTER CALIBRATION SHEET
//
// One page, printed 3 times. People write 1, 2 or 3 in the "This is sheet" box on each copy
// and measure four reference lines with a ruler: X1 and X2 from the LEFT paper edge, Y1 and
// Y2 from the TOP edge (the two edges a printer registers each sheet against). Two lines per
// axis, far apart, so the server can detect scaling.
//
// The line positions are CALIBRATION_REF v2 and must not move: saved printers were measured
// against them.
//
// Kept plain on purpose: a few short steps in words, then one line to write on per
// measurement ("Your measurement from the LEFT edge to X1: ______ mm"). No pictures or
// tables, and never where a line "should" be: people copied those numbers instead of
// measuring.
//
// Nothing on this page is a ruler: anything printed shifts with the very error being
// measured, so people measure with a physical ruler.
// ═══════════════════════════════════════════════════════════════

type Doc = PDFKit.PDFDocument;

const MM_PER_INCH = 25.4;
// ISO/IEC 7810 ID-1: every bank card is exactly 85.60 mm wide.
const BANK_CARD_WIDTH_MM = 85.6;

export const CALIBRATION_LINES = [
  { key: "x1", label: "X1", from: "LEFT" },
  { key: "x2", label: "X2", from: "LEFT" },
  { key: "y1", label: "Y1", from: "TOP" },
  { key: "y2", label: "Y2", from: "TOP" },
] as const;

const INK = "#000000";
const SOFT = "#444444";
const FAINT = "#888888";

export function drawCalibrationSheet(doc: Doc, o: { workspaceName: string; paperSize: PaperSize; date: string }): void {
  const paper = PAPER[o.paperSize];
  const ref = CALIBRATION_REF[o.paperSize];
  const W = paper.width;
  const X1 = ref.x1 * PTS_PER_INCH;
  const X2 = ref.x2 * PTS_PER_INCH;
  const Y1 = ref.y1 * PTS_PER_INCH;
  const Y2 = ref.y2 * PTS_PER_INCH;

  // ── Header (above line Y1) ──
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK);
  doc.text("PRINTER CALIBRATION SHEET", X1, 18, { lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(SOFT);
  doc.text(`${o.workspaceName}  ·  ${paper.label}`, X1, 36, { width: X2 - X1 - 150, height: 10, ellipsis: true });
  // Where people number their copies.
  const boxW = 34;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
  doc.text("THIS IS SHEET", X2 - boxW - 86, 27, { width: 80, align: "right", lineBreak: false });
  doc.strokeColor(INK).lineWidth(1.2).roundedRect(X2 - boxW, 14, boxW, 34, 4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(SOFT);
  doc.text("write 1, 2 or 3", X2 - boxW - 86, 39, { width: 80, align: "right", lineBreak: false });

  // ── Reference lines. Spans are chosen so no two lines cross. ──
  doc.strokeColor(INK).lineWidth(0.75);
  doc.moveTo(X1, Y1 + 18).lineTo(X1, Y2 - 18).stroke();
  doc.moveTo(X2, Y1 + 18).lineTo(X2, Y2 - 18).stroke();
  doc.moveTo(X1 + 18, Y1).lineTo(X2 - 18, Y1).stroke();
  doc.moveTo(X1 + 18, Y2).lineTo(X2 - 18, Y2).stroke();

  // Each line's name, and where its measurement starts.
  const label = (name: string, from: string) => `${name}  ·  measure from the ${from} edge to this line`;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK);
  for (const [x, name] of [[X1, "X1"], [X2, "X2"]] as const) {
    doc.save();
    doc.translate(x + 3, Y2 - 24);
    doc.rotate(-90);
    doc.text(label(name, "LEFT"), 0, 0, { lineBreak: false });
    doc.restore();
  }
  for (const [y, name] of [[Y1, "Y1"], [Y2, "Y2"]] as const) {
    doc.text(label(name, "TOP"), X1 + 24, y - 11, { lineBreak: false });
  }

  // ── Content, kept between the lines ──
  const L = X1 + 30;
  const CW = X2 - 30 - L;
  let y = Y1 + 26;

  doc.rect(L, y, CW, 26).fill("#CC0000");
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor("#FFFFFF");
  doc.text("PRINT THIS PAGE 3 TIMES, AT ACTUAL SIZE (100%)", L, y + 8, { width: CW, align: "center", lineBreak: false });
  y += 34;
  doc.font("Helvetica").fontSize(8.5).fillColor("#660000");
  doc.text("Turn off \"Fit to page\" and \"Shrink\". Scale must be 100%.", L, y, { width: CW, align: "center" });
  y += 36;

  // ── How to measure: short steps in words ──
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
  doc.text("HOW TO MEASURE", L, y, { lineBreak: false });
  y += 22;
  const steps = [
    "Put the ruler's 0 exactly on the LEFT edge of the paper.",
    "Look at the number on the ruler where line X1 is. Write that number below.",
    "Do the same for X2 (also from the LEFT edge).",
    "For Y1 and Y2, put the ruler's 0 on the TOP edge: the edge that went into the printer first.",
    "Write what YOUR ruler shows. Do not copy any number from this page.",
    "Do the same on the other 2 copies. Then type the numbers into the app.",
  ];
  doc.font("Helvetica").fontSize(10.5).fillColor(INK);
  steps.forEach((step, i) => {
    doc.font("Helvetica-Bold").text(`${i + 1}.`, L, y, { lineBreak: false });
    doc.font("Helvetica").text(step, L + 18, y, { width: CW - 18 });
    y += doc.heightOfString(step, { width: CW - 18 }) + 9;
  });
  y += 26;

  // ── One line to write on per measurement ──
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
  doc.text("YOUR MEASUREMENTS ON THIS SHEET", L, y, { lineBreak: false });
  y += 30;
  const prompts = CALIBRATION_LINES.map((line) => `Your measurement from the ${line.from} edge to ${line.label}:`);
  doc.font("Helvetica").fontSize(11).fillColor(INK);
  // Every blank starts at the same place, after the longest prompt.
  const start = L + Math.max(...prompts.map((p) => doc.widthOfString(p))) + 12;
  for (const prompt of prompts) {
    doc.text(prompt, L, y, { lineBreak: false });
    doc.strokeColor(INK).lineWidth(0.6).moveTo(start, y + 12).lineTo(start + 110, y + 12).stroke();
    doc.text("mm", start + 116, y, { lineBreak: false });
    y += 34;
  }
  y += 22;

  // ── Ruler-free scale check ──
  const barW = (BANK_CARD_WIDTH_MM / MM_PER_INCH) * PTS_PER_INCH;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
  doc.text("SCALE CHECK", L, y, { lineBreak: false });
  y += 14;
  doc.font("Helvetica").fontSize(8.5).fillColor(SOFT);
  const scaleText = "A bank card laid on this bar should be exactly as long as it. If the bar is shorter, the page was shrunk: print it again at 100%.";
  doc.text(scaleText, L, y, { width: CW });
  y += doc.heightOfString(scaleText, { width: CW }) + 10;
  doc.rect(L, y, barW, 5).fill(INK);
  doc.strokeColor(INK).lineWidth(0.75);
  doc.moveTo(L, y - 5).lineTo(L, y + 10).stroke();
  doc.moveTo(L + barW, y - 5).lineTo(L + barW, y + 10).stroke();

  // ── Footer (below line Y2) ──
  doc.font("Helvetica").fontSize(6.5).fillColor(FAINT);
  doc.text(
    `SmartBusinessSolutions  ·  Calibration sheet v${CALIBRATION_REF.version}  ·  ${o.date}  ·  ${paper.label}`,
    0,
    Y2 + 16,
    { width: W, align: "center", lineBreak: false },
  );
}
