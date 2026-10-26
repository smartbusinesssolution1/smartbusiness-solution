import ExcelJS from "exceljs";
import type { CellValue, ExportColumn, ExportTable } from "./export-table.js";

// ═══════════════════════════════════════════════════════════════
// EXCEL (.xlsx)
//
// Real typed cells: amounts are numbers formatted as dollars (so SUM works), dates are
// dates. The title and filter lines sit above the table; the header row is frozen and
// has filter buttons; the totals row is bold. Text is always written as text, never as
// a formula, so a payee name cannot run as one.
// ═══════════════════════════════════════════════════════════════

const NUMBER_FORMAT: Record<ExportColumn["type"], string | undefined> = {
  text: "@",
  integer: "0",
  money: '"$"#,##0.00',
  date: "yyyy-mm-dd",
  datetime: "yyyy-mm-dd hh:mm",
};

function value(v: CellValue, column: ExportColumn): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (column.type === "money" || column.type === "integer") return Number(v);
  if ((column.type === "date" || column.type === "datetime") && v instanceof Date) return v;
  // A plain string: exceljs never turns it into a formula.
  return String(v);
}

export async function renderXlsx(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SmartBusiness Checks";
  workbook.created = new Date();
  // Sheet names: at most 31 characters, none of : \ / ? * [ ]
  const sheet = workbook.addWorksheet(table.title.replace(/[:\\/?*[\]]/g, " ").slice(0, 31));

  const width = table.columns.length;
  sheet.addRow([table.title]).font = { bold: true, size: 14 };
  for (const line of table.subtitle) sheet.addRow([line]).font = { color: { argb: "FF555555" } };
  sheet.addRow([]);
  for (let r = 1; r <= table.subtitle.length + 1; r++) sheet.mergeCells(r, 1, r, Math.max(width, 1));

  const headerRow = sheet.addRow(table.columns.map((c) => c.label));
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF1F5" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFB8C0CC" } } };
  });
  const headerRowNumber = headerRow.number;

  for (const row of table.rows) {
    sheet.addRow(table.columns.map((c) => value(row[c.key], c)));
  }

  if (table.totals) {
    const totalsRow = sheet.addRow(table.columns.map((c) => value(table.totals![c.key], c)));
    totalsRow.font = { bold: true };
    totalsRow.eachCell((c) => {
      c.border = { top: { style: "thin", color: { argb: "FF8A94A3" } } };
    });
  }

  table.columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = Math.round(12 * (c.width ?? 1));
    const fmt = NUMBER_FORMAT[c.type];
    // Applied to the data rows only, not the title lines above.
    for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
      if (fmt) sheet.getCell(r, i + 1).numFmt = fmt;
    }
  });

  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber + table.rows.length, column: Math.max(width, 1) },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
