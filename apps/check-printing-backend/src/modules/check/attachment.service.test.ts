import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ATTACHMENT_LIMITS } from "./attachment.repository.js";
import { MAX_PROCESSED_IMAGE_BYTES, prepareContent } from "./attachment.service.js";

// A photo-like JPEG that compresses badly: random pixels saved at a low quality. Re-encoded
// at quality 90 it comes out about 45% larger than the file that was uploaded.
async function noisyJpeg(side: number, quality: number): Promise<Buffer> {
  const raw = Buffer.alloc(side * side * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0;
  return sharp(raw, { raw: { width: side, height: side, channels: 3 } }).jpeg({ quality }).toBuffer();
}

describe("prepareContent (attachments)", () => {
  // BUG_013: the 10 MB limit was checked after re-encoding, so an image under 10 MB that
  // grew when re-encoded was refused as "must be 10 MB or smaller".
  it("accepts an image under 10 MB that grows past 10 MB when re-encoded", async () => {
    const original = await noisyJpeg(4600, 55);
    expect(original.length).toBeLessThan(ATTACHMENT_LIMITS.maxFileBytes);

    const stored = await prepareContent(original, "jpeg");

    expect(stored.length).toBeGreaterThan(ATTACHMENT_LIMITS.maxFileBytes);
    expect(stored.length).toBeLessThanOrEqual(MAX_PROCESSED_IMAGE_BYTES);
  });

  it("still re-encodes images (metadata is dropped)", async () => {
    const withExif = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#3366cc" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Make: "SecretPhone" } } })
      .toBuffer();
    expect(withExif.includes("SecretPhone")).toBe(true);

    const stored = await prepareContent(withExif, "jpeg");

    expect(stored.includes("SecretPhone")).toBe(false);
  });

  it("tells a very large image it is too large, not that it could not be read", async () => {
    // 8000 × 7000 = 56 MP, a single colour so the file itself is small.
    const huge = await sharp({ create: { width: 8000, height: 7000, channels: 3, background: "#ffffff" } }).png().toBuffer();

    await expect(prepareContent(huge, "png")).rejects.toMatchObject({
      statusCode: 422,
      code: "IMAGE_TOO_LARGE",
      message: expect.stringMatching(/too large \(56 megapixels; the most is 50\)/),
    });
  });

  it("refuses a file that is not really an image", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("not an image at all")]);

    await expect(prepareContent(fake, "jpeg")).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });

  it("keeps a PDF byte for byte", async () => {
    const pdf = Buffer.from("%PDF-1.4\n%fake but untouched\n");

    expect(await prepareContent(pdf, "pdf")).toBe(pdf);
  });
});
