import { isoMinute, usd, usDay, type CellValue, type ExportColumn, type ExportTable } from "./export-table.js";

// ═══════════════════════════════════════════════════════════════
// PDF
//
// A printable report: landscape Letter, the title and filter lines on the first page, the
// column header repeated on every page, totals at the end, and "Page 2 of 5" on each page
// so a printed copy is complete and in order. Long text is cut with "…" rather than
// wrapping, so every check stays on one line. Columns marked pdf: false are left out.
// ═══════════════════════════════════════════════════════════════

const PAGE = { width: 792, height: 612, margin: 36 } as const;
const ROW_HEIGHT = 15;
export const PDF_FONT_SIZE = 7.5;
const FONT_SIZE = PDF_FONT_SIZE;
// Space left and right of the text inside each cell.
const CELL_PADDING = 6;

// The columns that appear in the PDF and each one's width in points, shared out by weight.
export function pdfColumnWidths(columns: ExportColumn[]): Array<{ column: ExportColumn; width: number }> {
  const shown = columns.filter((c) => c.pdf !== false);
  const usable = PAGE.width - 2 * PAGE.margin;
  const sum = shown.reduce((a, c) => a + (c.width ?? 1), 0);
  return shown.map((column) => ({ column, width: ((column.width ?? 1) / sum) * usable }));
}

// Room for text in a cell of that width.
export const pdfTextWidth = (cellWidth: number) => cellWidth - CELL_PADDING;

function text(v: CellValue, column: ExportColumn): string {
  if (v === null || v === undefined || v === "") return "";
  switch (column.type) {
    case "money":
      return usd(v instanceof Date ? 0 : v);
    case "integer":
      return String(v);
    case "date":
      return v instanceof Date ? usDay(v) : String(v);
    case "datetime":
      // The column label says (UTC).
      return v instanceof Date ? isoMinute(v) : String(v);
    case "text":
      return String(v);
  }
}

const rightAligned = (c: ExportColumn) => c.type === "money" || c.type === "integer";

export async function renderPdf(table: ExportTable, generatedAt: Date): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: PAGE.margin,
    bufferPages: true,
    info: { Title: table.title, Creator: "SmartBusiness Checks" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const layout = pdfColumnWidths(table.columns);
  const columns = layout.map((l) => l.column);
  const widths = layout.map((l) => l.width);
  const usable = PAGE.width - 2 * PAGE.margin;
  const bottom = PAGE.height - PAGE.margin - 18; // room for the footer

  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111").text(table.title, PAGE.margin, PAGE.margin);
  doc.font("Helvetica").fontSize(8.5).fillColor("#555555");
  for (const line of table.subtitle) doc.text(line, { width: usable });
  let y = doc.y + 10;

  // The longest start of the text that fits the width, with "…" when cut. PDFKit wraps
  // text given a width even with lineBreak: false, so cells are cut here instead.
  const fit = (s: string, width: number) => {
    if (doc.widthOfString(s) <= width) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (doc.widthOfString(`${s.slice(0, mid).trimEnd()}…`) <= width) lo = mid;
      else hi = mid - 1;
    }
    return `${s.slice(0, lo).trimEnd()}…`;
  };

  const drawRow = (cells: string[], options: { bold?: boolean; line?: boolean } = {}) => {
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(FONT_SIZE).fillColor("#111111");
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      const width = pdfTextWidth(widths[i]!);
      doc.text(fit(cells[i] ?? "", width), x + 3, y, { width, align: rightAligned(c) ? "right" : "left", lineBreak: false });
      x += widths[i]!;
    });
    if (options.line) {
      doc.moveTo(PAGE.margin, y + ROW_HEIGHT - 3).lineTo(PAGE.margin + usable, y + ROW_HEIGHT - 3).lineWidth(0.4).strokeColor("#c9ced6").stroke();
    }
    y += ROW_HEIGHT;
  };
  // Labels may wrap onto a second line; the header row grows to fit them.
  const header = () => {
    doc.font("Helvetica-Bold").fontSize(FONT_SIZE);
    const height = Math.max(ROW_HEIGHT, ...columns.map((c, i) => doc.heightOfString(c.label, { width: pdfTextWidth(widths[i]!) }) + 6));
    doc.rect(PAGE.margin, y - 3, usable, height).fill("#eef1f5");
    doc.fillColor("#111111");
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      doc.text(c.label, x + 3, y, { width: pdfTextWidth(widths[i]!), align: rightAligned(c) ? "right" : "left" });
      x += widths[i]!;
    });
    y += height;
  };

  header();
  if (table.rows.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555555").text(table.emptyMessage ?? "No checks match these filters.", PAGE.margin, y + 4);
    y += ROW_HEIGHT;
  }
  for (const row of table.rows) {
    if (y + ROW_HEIGHT > bottom) {
      doc.addPage();
      y = PAGE.margin;
      header();
    }
    drawRow(columns.map((c) => text(row[c.key], c)), { line: true });
  }
  if (table.totals) {
    if (y + ROW_HEIGHT > bottom) {
      doc.addPage();
      y = PAGE.margin;
      header();
    }
    drawRow(columns.map((c) => text(table.totals![c.key], c)), { bold: true });
  }

  // Footer on every page, now that the page count is known. It sits inside the bottom
  // margin, so the margin is lifted first: otherwise PDFKit reads it as an overflow and
  // adds a blank page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor("#888888").text(
      `${table.title} · generated ${isoMinute(generatedAt)} UTC · page ${i + 1} of ${range.count}`,
      PAGE.margin,
      PAGE.height - PAGE.margin - 8,
      { width: usable, align: "center", lineBreak: false },
    );
  }

  doc.end();
  return done;
}
