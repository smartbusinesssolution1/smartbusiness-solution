import { afterEach, describe, expect, it, vi } from "vitest";
import PDFDocument from "pdfkit";
import { ACTIVITY_CATEGORIES } from "./activity-catalog.js";
import { ACTIVITY_EXPORT_COLUMNS } from "./activity.service.js";
import { PDF_FONT_SIZE, pdfColumnWidths, pdfTextWidth, renderPdf } from "../export/pdf.js";
import type { ExportTable } from "../export/export-table.js";

describe("activity log PDF", () => {
  afterEach(() => vi.restoreAllMocks());

  // BUG_064: PDF cells are one line, cut with "…". At the old width three category names
  // were cut ("Approval rules and limits", "Downloads and exports", "Sign-ins and security").
  it("has a Category column wide enough for every category name", () => {
    const doc = new PDFDocument();
    doc.font("Helvetica").fontSize(PDF_FONT_SIZE);
    const category = pdfColumnWidths(ACTIVITY_EXPORT_COLUMNS).find((c) => c.column.key === "category")!;
    const room = pdfTextWidth(category.width);

    const tooWide = Object.values(ACTIVITY_CATEGORIES).filter((name) => doc.widthOfString(name) > room);

    expect(tooWide).toEqual([]);
  });

  const table = (over: Partial<ExportTable> = {}): ExportTable => ({
    title: "Activity log",
    subtitle: [],
    columns: ACTIVITY_EXPORT_COLUMNS,
    rows: [],
    fileName: "activity",
    ...over,
  });

  const written = () => {
    const spy = vi.spyOn(PDFDocument.prototype, "text");
    return () => spy.mock.calls.map((call) => String(call[0]));
  };

  it("says there is no activity when nothing matches, not that no checks match", async () => {
    const texts = written();

    await renderPdf(table({ emptyMessage: "No activity matches these filters." }), new Date());

    expect(texts()).toContain("No activity matches these filters.");
    expect(texts()).not.toContain("No checks match these filters.");
  });

  it("keeps the check register's wording when no message is given", async () => {
    const texts = written();

    await renderPdf(table({ title: "Check register" }), new Date());

    expect(texts()).toContain("No checks match these filters.");
  });
});
