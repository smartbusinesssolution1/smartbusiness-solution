// The real type of an uploaded file, read from its first bytes ("magic number").
// A file name or the browser's Content-Type can say anything; these bytes cannot be
// faked without breaking the file.

export type DetectedFileType = "pdf" | "png" | "jpeg";

export const MIME_TYPES: Record<DetectedFileType, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

export function detectFileType(bytes: Buffer): DetectedFileType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 5 && bytes.subarray(0, 5).equals(PDF_SIGNATURE)) return "pdf";
  return null;
}
