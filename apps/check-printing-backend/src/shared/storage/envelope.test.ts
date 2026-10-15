import { randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import { buildKeyring, open, seal, StorageIntegrityError } from "./envelope.js";

const PDF = Buffer.from("%PDF-1.7\nCheck #1005  Pay to ABC Supplies  $4,800.00  ⑈001005⑈ ⑆111000025⑆ 987654321012⑈\n%%EOF");
const NAME = "checks/ws-1/check-1005.pdf";
const k1 = { id: "k1", hex: randomBytes(32).toString("hex") };
const k2 = { id: "k2", hex: randomBytes(32).toString("hex") };
const ring = buildKeyring(k1);

describe("envelope encryption", () => {
  it("round-trips a file", () => {
    expect(open(seal(PDF, ring, NAME), ring, NAME)).toEqual(PDF);
  });

  it("stores nothing readable: no payee, no account number, no PDF marker", () => {
    const sealed = seal(PDF, ring, NAME).toString("latin1");
    expect(sealed).not.toContain("%PDF");
    expect(sealed).not.toContain("ABC Supplies");
    expect(sealed).not.toContain("987654321012");
    expect(sealed.startsWith("SBE1")).toBe(true);
  });

  it("uses a fresh data key and IV every time", () => {
    expect(seal(PDF, ring, NAME).equals(seal(PDF, ring, NAME))).toBe(false);
  });

  it("refuses a file with any single byte changed", () => {
    const sealed = seal(PDF, ring, NAME);
    for (const position of [8, 20, 60, 90, sealed.length - 1]) {
      const tampered = Buffer.from(sealed);
      tampered[position] = tampered[position]! ^ 0xff;
      expect(() => open(tampered, ring, NAME), `byte ${position}`).toThrow(StorageIntegrityError);
    }
  });

  it("refuses a file swapped in from another storage name", () => {
    const sealedForOtherCheck = seal(PDF, ring, "checks/ws-1/check-1006.pdf");
    expect(() => open(sealedForOtherCheck, ring, NAME)).toThrow(/integrity check/);
  });

  it("refuses a plain, unencrypted file", () => {
    expect(() => open(PDF, ring, NAME)).toThrow(/Not an encrypted file/);
  });

  it("refuses a truncated file", () => {
    expect(() => open(seal(PDF, ring, NAME).subarray(0, 40), ring, NAME)).toThrow(/truncated/);
  });

  it("refuses a file sealed with a master key it does not have", () => {
    const sealedWithK2 = seal(PDF, buildKeyring(k2), NAME);
    expect(() => open(sealedWithK2, ring, NAME)).toThrow(/unknown master key "k2"/);
  });

  it("refuses a different key that claims the same id", () => {
    const impostor = buildKeyring({ id: "k1", hex: randomBytes(32).toString("hex") });
    expect(() => open(seal(PDF, impostor, NAME), ring, NAME)).toThrow(/integrity check/);
  });

  it("supports key rotation: new files use the new key, old files still open", () => {
    const oldFile = seal(PDF, buildKeyring(k1), NAME);
    const rotated = buildKeyring(k2, [k1]);

    expect(open(oldFile, rotated, NAME)).toEqual(PDF);
    const newFile = seal(PDF, rotated, NAME);
    expect(newFile.subarray(5, 7).toString()).toBe("k2");
    expect(() => open(newFile, buildKeyring(k1), NAME)).toThrow(/unknown master key/);
  });

  it("refuses a master key of the wrong length", () => {
    expect(() => buildKeyring({ id: "bad", hex: "abcd" })).toThrow(/64 hex characters/);
  });
});
