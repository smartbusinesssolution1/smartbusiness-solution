// ═══════════════════════════════════════════════════════════════
// ONE TABLE, THREE FILES
//
// Every export (the check register, outstanding checks, the number audit) is described
// once as an ExportTable; csv.ts, xlsx.ts and pdf.ts each turn it into a file. So the
// three formats can never disagree about which checks or which columns.
// ═══════════════════════════════════════════════════════════════

export type ExportFormat = "csv" | "xlsx" | "pdf";
export const EXPORT_FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];

// text: as is. integer: a whole number. money: a decimal string like "1250.50" (never a
// float: no rounding drift). date: a calendar day (UTC midnight, as check dates are
// stored). datetime: a moment, shown in UTC.
export type ColumnType = "text" | "integer" | "money" | "date" | "datetime";

export interface ExportColumn {
  key: string;
  label: string;
  type: ColumnType;
  // Relative width in the PDF and the spreadsheet (default 1).
  width?: number;
  // false: in the CSV and the spreadsheet only. A printed page has room for about a dozen
  // columns; the files people work on keep every detail.
  pdf?: boolean;
}

export type CellValue = string | number | Date | null | undefined;

export interface ExportTable {
  // "Check register": the sheet name, the PDF title, the start of the file name.
  title: string;
  // Lines under the title: workspace, filters, who generated it and when.
  subtitle: string[];
  columns: ExportColumn[];
  rows: Array<Record<string, CellValue>>;
  // A closing row (spreadsheet and PDF only): values by column key.
  totals?: Record<string, CellValue>;
  // File name without extension, e.g. "check-register-2026-10-22".
  fileName: string;
}

export interface RenderedFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// "2026-10-22" for a calendar day stored as UTC midnight.
export function isoDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// "10/22/2026", the way US accountants and banks write dates.
export function usDay(d: Date): string {
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`;
}

// "2026-10-22 14:03" (UTC).
export function isoMinute(d: Date): string {
  return `${isoDay(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "$1,250.50" from "1250.50".
export function usd(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
