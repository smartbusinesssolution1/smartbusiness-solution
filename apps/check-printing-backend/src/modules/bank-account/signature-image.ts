import sharp, { type Metadata, type OutputInfo } from "sharp";
import { AppError } from "../../shared/errors/index.js";
import { detectFileType } from "../../shared/utils/file-type.js";

// ═══════════════════════════════════════════════════════════════
// SIGNATURE IMAGE CLEAN-UP
//
// Turns an uploaded scan or phone photo of a signature into a clean, printable PNG:
// dark ink on a transparent background, trimmed and resized, with no metadata.
//
//   1. real type from the first bytes (PNG or JPEG only)
//   2. size from the header, before decoding (stops decompression bombs)
//   3. rotate as the camera intended, greyscale
//   4. measure the paper's brightness (the brightest 10% of pixels)
//   5. paper → transparent, ink → near-black, smooth edge in between
//   6. trim the empty margins, 7. shrink to at most 1200 × 400, save as PNG
//
// Re-encoding drops all metadata (GPS location, camera and phone details).
// ═══════════════════════════════════════════════════════════════

export const SIGNATURE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minWidth: 150,
  minHeight: 40,
  outputMaxWidth: 1200,
  outputMaxHeight: 400,
} as const;

const PAPER_PERCENTILE = 0.9; // the paper is the brightest part of the image
const PAPER_MARGIN = 45; // anything within this much of the paper's brightness is paper
const INK_RAMP = 90; // darker than (paper - margin - ramp) is fully opaque ink
const MIN_PAPER_BRIGHTNESS = 100; // a darker "paper" means a bad photo
const MAX_INK_COVERAGE = 0.5; // a signature never covers half its own bounding box
const INK = 17; // near-black, prints crisply on any toner
const PADDING = 8;

export type SignatureImageType = "png" | "jpeg";

export class SignatureImageError extends AppError {
  constructor(message: string, statusCode = 422, code = "INVALID_SIGNATURE_IMAGE") {
    super(message, statusCode, code);
  }
}

// The real image type, from the file's first bytes (shared detector).
export function detectImageType(bytes: Buffer): SignatureImageType | null {
  const type = detectFileType(bytes);
  return type === "png" || type === "jpeg" ? type : null;
}

export interface CleanSignature {
  png: Buffer;
  width: number;
  height: number;
}

export async function cleanSignatureImage(upload: Buffer): Promise<CleanSignature> {
  if (upload.length > SIGNATURE_LIMITS.maxBytes) {
    throw new SignatureImageError("The signature image must be 5 MB or smaller.", 413, "PAYLOAD_TOO_LARGE");
  }

  const type = detectImageType(upload);
  if (!type) {
    throw new SignatureImageError("Upload the signature as a PNG or JPEG image.", 415, "UNSUPPORTED_IMAGE_TYPE");
  }

  // Read only the header first: refuse a huge image before spending memory on it.
  let meta: Metadata;
  try {
    meta = await sharp(upload, { limitInputPixels: false }).metadata();
  } catch {
    throw new SignatureImageError("This file could not be read as an image. Upload a PNG or JPEG.");
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (meta.format !== type) {
    throw new SignatureImageError("The file's contents do not match its image type. Upload a PNG or JPEG.");
  }
  if (width * height > SIGNATURE_LIMITS.maxPixels) {
    throw new SignatureImageError("The image is too large. Use an image under 25 megapixels.");
  }

  // Greyscale pixels, rotated as the camera intended (EXIF orientation).
  let grey: { data: Buffer; info: OutputInfo };
  try {
    grey = await sharp(upload, { limitInputPixels: SIGNATURE_LIMITS.maxPixels, failOn: "error" })
      .rotate()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new SignatureImageError("This file could not be read as an image. Upload a PNG or JPEG.");
  }
  const { data, info } = grey;
  if (info.width < SIGNATURE_LIMITS.minWidth || info.height < SIGNATURE_LIMITS.minHeight) {
    throw new SignatureImageError(
      `The image is too small. Use one at least ${SIGNATURE_LIMITS.minWidth} × ${SIGNATURE_LIMITS.minHeight} pixels.`,
    );
  }

  // How bright is the paper? The brightest 10% of pixels.
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += info.channels) histogram[data[i]!]!++;
  const pixels = info.width * info.height;
  let seen = 0;
  let paper = 255;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v]!;
    if (seen >= pixels * PAPER_PERCENTILE) {
      paper = v;
      break;
    }
  }
  if (paper < MIN_PAPER_BRIGHTNESS) {
    throw new SignatureImageError("The background is too dark. Photograph the signature on plain white paper.");
  }

  // Paper → transparent, ink → opaque near-black, with a smooth ramp for clean edges.
  const clearAbove = paper - PAPER_MARGIN;
  const solidBelow = Math.max(clearAbove - INK_RAMP, 0);
  const rgba = Buffer.alloc(pixels * 4);
  let top = info.height;
  let left = info.width;
  let bottom = -1;
  let right = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = y * info.width + x;
      const level = data[i * info.channels]!;
      const alpha =
        level >= clearAbove ? 0 : level <= solidBelow ? 255 : Math.round(((clearAbove - level) / (clearAbove - solidBelow)) * 255);
      const o = i * 4;
      rgba[o] = INK;
      rgba[o + 1] = INK;
      rgba[o + 2] = INK;
      rgba[o + 3] = alpha;
      if (alpha > 32) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) {
    throw new SignatureImageError("We couldn't find a signature in this image. Sign in dark ink on white paper.");
  }

  // Trim to the ink, with a little room around it.
  const crop = {
    left: Math.max(left - PADDING, 0),
    top: Math.max(top - PADDING, 0),
    width: 0,
    height: 0,
  };
  crop.width = Math.min(right + PADDING, info.width - 1) - crop.left + 1;
  crop.height = Math.min(bottom + PADDING, info.height - 1) - crop.top + 1;

  let ink = 0;
  for (let y = crop.top; y < crop.top + crop.height; y++) {
    for (let x = crop.left; x < crop.left + crop.width; x++) {
      if (rgba[(y * info.width + x) * 4 + 3]! > 128) ink++;
    }
  }
  if (ink / (crop.width * crop.height) > MAX_INK_COVERAGE) {
    throw new SignatureImageError("The background is too dark. Photograph the signature on plain white paper.");
  }

  const { data: png, info: out } = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(crop)
    .resize({
      width: SIGNATURE_LIMITS.outputMaxWidth,
      height: SIGNATURE_LIMITS.outputMaxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return { png, width: out.width, height: out.height };
}
