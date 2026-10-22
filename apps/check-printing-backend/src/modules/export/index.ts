import { renderCsv } from "./csv.js";
import { renderPdf } from "./pdf.js";
import { renderXlsx } from "./xlsx.js";
import type { ExportFormat, ExportTable, RenderedFile } from "./export-table.js";

export * from "./export-table.js";
export { neutraliseFormula, renderCsv } from "./csv.js";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export async function renderExport(table: ExportTable, format: ExportFormat, generatedAt = new Date()): Promise<RenderedFile> {
  const buffer =
    format === "csv" ? renderCsv(table) : format === "xlsx" ? await renderXlsx(table) : await renderPdf(table, generatedAt);
  return { buffer, contentType: CONTENT_TYPES[format], fileName: `${table.fileName}.${format}` };
}
export { exportFormat } from "./export-format.js";
