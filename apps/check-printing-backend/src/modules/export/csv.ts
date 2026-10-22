import { isoDay, isoMinute, type CellValue, type ExportColumn, type ExportTable } from "./export-table.js";

// ═══════════════════════════════════════════════════════════════
// CSV
//
// Pure data: one header row, then one row per check. No title lines and no totals row,
// so the file imports cleanly into Excel, Google Sheets or accounting software.
// UTF-8 with a byte-order mark, so Excel shows names like "José" correctly.
//
// Formula injection: a spreadsheet runs a cell that starts with = + - @ (or a tab or
// return) as a formula. A payee named =HYPERLINK("https://evil…","Click") would become a
// live link in the accountant's Excel. Such text cells get a leading apostrophe, which
// spreadsheets show as plain text.
// ═══════════════════════════════════════════════════════════════

const FORMULA_START = /^[=+\-@\t\r]/;

export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function quote(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function cell(value: CellValue, column: ExportColumn): string {
  if (value === null || value === undefined || value === "") return "";
  switch (column.type) {
    case "integer":
    case "money":
      // Numbers stay bare so spreadsheets treat them as numbers.
      return String(value);
    case "date":
      return value instanceof Date ? isoDay(value) : quote(neutraliseFormula(String(value)));
    case "datetime":
      return value instanceof Date ? isoMinute(value) : quote(neutraliseFormula(String(value)));
    case "text":
      return quote(neutraliseFormula(String(value)));
  }
}

export function renderCsv(table: Pick<ExportTable, "columns" | "rows">, options: { byteOrderMark?: boolean } = {}): Buffer {
  const lines = [
    table.columns.map((c) => quote(c.label)).join(","),
    ...table.rows.map((row) => table.columns.map((c) => cell(row[c.key], c)).join(",")),
  ];
  const body = lines.join("\r\n") + "\r\n";
  return Buffer.from((options.byteOrderMark ?? true ? "﻿" : "") + body, "utf8");
}
