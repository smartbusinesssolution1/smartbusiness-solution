import { describe, expect, it } from "vitest";
import { SecretBox } from "../../src/shared/services/secret-box.js";

const box = new SecretBox("11".repeat(32));

describe("SecretBox", () => {
  it("what is sealed opens to the same text", () => {
    expect(box.open(box.seal("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"))).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("the stored value doesn't contain the secret, and differs every time (fresh IV)", () => {
    const a = box.seal("GEZDGNBVGY3TQOJQ");
    const b = box.seal("GEZDGNBVGY3TQOJQ");
    expect(a).not.toContain("GEZDGNBVGY3TQOJQ");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("a different key can't open it", () => {
    expect(() => new SecretBox("22".repeat(32)).open(box.seal("secret"))).toThrow();
  });

  it("any edit to the stored value is detected, not silently decrypted", () => {
    const [v, iv, tag, ct] = box.seal("secret").split(".");
    const flipped = ct!.startsWith("A") ? `B${ct!.slice(1)}` : `A${ct!.slice(1)}`;
    expect(() => box.open([v, iv, tag, flipped].join("."))).toThrow();
    expect(() => box.open("not-sealed")).toThrow();
  });

  it("fingerprints are stable, keyed, and 64 hex characters", () => {
    expect(box.fingerprint("ABCD-EFGH-JK")).toBe(box.fingerprint("ABCD-EFGH-JK"));
    expect(box.fingerprint("ABCD-EFGH-JK")).toMatch(/^[0-9a-f]{64}$/);
    expect(new SecretBox("22".repeat(32)).fingerprint("ABCD-EFGH-JK")).not.toBe(box.fingerprint("ABCD-EFGH-JK"));
  });

  it("refuses a key that isn't 256 bits", () => {
    expect(() => new SecretBox("abcd")).toThrow();
  });
});
