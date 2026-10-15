import { config } from "../../config/index.js";
import { fileStorage } from "../../shared/storage/instance.js";
import { PdfRenderer } from "./pdf.renderer.js";
import { PdfService } from "./pdf.service.js";

export const pdfRenderer = new PdfRenderer(config.E13B_FONT_PATH, {
  strictFont: config.E13B_FONT_STRICT,
});
export { fileStorage };
export const pdfService = new PdfService(pdfRenderer, fileStorage);

export { PdfRenderer } from "./pdf.renderer.js";
export { PdfService } from "./pdf.service.js";
export type { CheckPdfData, PaperSize } from "./pdf.types.js";
export { buildCheckTemplate } from "./pdf.templates.js";
export { MICR, PTS_PER_INCH } from "./pdf.types.js";
