import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cleanSignatureImage, detectImageType, SIGNATURE_LIMITS } from "./signature-image.js";

// #3: uploaded signatures become clean, printable PNGs, and bad uploads are refused.

// A signature-like stroke drawn on a background, as a scanner or phone would produce.
function signatureSvg(opts: { width?: number; height?: number; paper?: string; ink?: string } = {}): Buffer {
  const { width = 900, height = 300, paper = "#ffffff", ink = "#1a237e" } = opts;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${paper}"/>
      <path d="M ${width * 0.2} ${height * 0.6} C ${width * 0.3} ${height * 0.1}, ${width * 0.4} ${height * 0.9},
               ${width * 0.5} ${height * 0.5} S ${width * 0.7} ${height * 0.2}, ${width * 0.8} ${height * 0.55}"
            stroke="${ink}" stroke-width="10" fill="none" stroke-linecap="round"/>
    </svg>`,
  );
}

const scanPng = () => sharp(signatureSvg()).png().toBuffer();
const pixel = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * 4;
  return { r: data[o]!, g: data[o + 1]!, b: data[o + 2]!, a: data[o + 3]! };
};

describe("detectImageType", () => {
  it("recognises PNG and JPEG by their first bytes", async () => {
    expect(detectImageType(await scanPng())).toBe("png");
    expect(detectImageType(await sharp(signatureSvg()).jpeg().toBuffer())).toBe("jpeg");
  });

  it.each([
    ["a PDF", Buffer.from("%PDF-1.7\n...")],
    ["a GIF", Buffer.from("GIF89a......")],
    ["a script", Buffer.from("<script>alert(1)</script>")],
    ["an empty file", Buffer.alloc(0)],
  ])("does not mistake %s for an image", (_label, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });
});

describe("cleanSignatureImage", () => {
  it("turns a scan into dark ink on a transparent background", async () => {
    const { png, width, height } = await cleanSignatureImage(await scanPng());

    expect(detectImageType(png)).toBe("png");
    const meta = await sharp(png).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(width).toBeLessThanOrEqual(SIGNATURE_LIMITS.outputMaxWidth);
    expect(height).toBeLessThanOrEqual(SIGNATURE_LIMITS.outputMaxHeight);

    // Corners are paper: fully transparent.
    expect((await pixel(png, 0, 0)).a).toBe(0);
    expect((await pixel(png, width - 1, height - 1)).a).toBe(0);
  });

  it("prints blue ink as near-black", async () => {
    const { png } = await cleanSignatureImage(await scanPng());
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3]! === 255) {
        opaque++;
        expect(data[i]! + data[i + 1]! + data[i + 2]!).toBeLessThan(90);
      }
    }
    expect(opaque).toBeGreaterThan(100);
  });

  it("trims the empty margins around the signature", async () => {
    const { width, height } = await cleanSignatureImage(await scanPng());
    // The stroke spans about 60% of the 900 px width and part of the height.
    expect(width).toBeLessThan(700);
    expect(height).toBeLessThan(300);
  });

  it("handles a phone photo on grey paper", async () => {
    const photo = await sharp(signatureSvg({ paper: "#b4b4b4", ink: "#202040" })).jpeg({ quality: 80 }).toBuffer();
    const { png, width } = await cleanSignatureImage(photo);
    expect((await pixel(png, 0, 0)).a).toBe(0);
    expect(width).toBeGreaterThan(100);
  });

  it("drops all metadata, such as the camera and location", async () => {
    const withExif = await sharp(signatureSvg())
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo", Model: "Secret Device 9", Artist: "Jane Signer" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const { png } = await cleanSignatureImage(withExif);
    const meta = await sharp(png).metadata();
    expect(meta.exif).toBeUndefined();
    expect(png.toString("latin1")).not.toContain("Secret Device");
  });

  it("shrinks a very large scan to at most 1200 × 400", async () => {
    const big = await sharp(signatureSvg({ width: 4000, height: 2000 })).png().toBuffer();
    const { width, height } = await cleanSignatureImage(big);
    expect(width).toBeLessThanOrEqual(1200);
    expect(height).toBeLessThanOrEqual(400);
  });

  it("refuses a file that is not a PNG or JPEG", async () => {
    await expect(cleanSignatureImage(Buffer.from("%PDF-1.7 not an image"))).rejects.toMatchObject({
      statusCode: 415,
      code: "UNSUPPORTED_IMAGE_TYPE",
    });
  });

  it("refuses a PNG header followed by garbage", async () => {
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("garbage")]);
    await expect(cleanSignatureImage(fake)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("refuses an image over 25 megapixels before decoding it", async () => {
    const huge = await sharp({ create: { width: 6000, height: 4500, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(cleanSignatureImage(huge)).rejects.toThrow(/under 25 megapixels/);
  });

  it("refuses a file over 5 MB", async () => {
    await expect(cleanSignatureImage(Buffer.alloc(SIGNATURE_LIMITS.maxBytes + 1))).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("refuses an image that is too small to print well", async () => {
    const tiny = await sharp(signatureSvg({ width: 100, height: 30 })).png().toBuffer();
    await expect(cleanSignatureImage(tiny)).rejects.toThrow(/too small/);
  });

  it("refuses a blank page", async () => {
    const blank = await sharp({ create: { width: 800, height: 300, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(cleanSignatureImage(blank)).rejects.toThrow(/couldn't find a signature/);
  });

  it("refuses a photo whose background is too dark", async () => {
    const dark = await sharp(signatureSvg({ paper: "#303030", ink: "#000000" })).jpeg().toBuffer();
    await expect(cleanSignatureImage(dark)).rejects.toThrow(/background is too dark/);
  });
});
