import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertValidKey, InvalidStorageKeyError, LocalDiskStorage, StorageNotFoundError } from "./index.js";

describe("storage keys", () => {
  it.each(["checks/ws-1/check-1.pdf", "signatures/ws_1/bank-2.png", "a"])("accepts %s", (key) => {
    expect(() => assertValidKey(key)).not.toThrow();
  });

  it.each([
    ["a parent traversal", "../outside.pdf"],
    ["a hidden traversal", "checks/../../outside.pdf"],
    ["an absolute path", "/etc/passwd"],
    ["a Windows path", "C:\\Windows\\win.ini"],
    ["an empty segment", "checks//x.pdf"],
    ["a dot segment", "checks/./x.pdf"],
    ["an empty key", ""],
    ["spaces", "checks/my file.pdf"],
  ])("refuses %s", (_label, key) => {
    expect(() => assertValidKey(key)).toThrow(InvalidStorageKeyError);
  });
});

describe("LocalDiskStorage", () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "local-storage-test-"));
    storage = new LocalDiskStorage(root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("stores, reads and deletes a file", async () => {
    await storage.put("checks/ws-1/a.pdf", Buffer.from("hello"), "application/pdf");
    expect((await storage.get("checks/ws-1/a.pdf")).toString()).toBe("hello");
    await storage.delete("checks/ws-1/a.pdf");
    await expect(storage.get("checks/ws-1/a.pdf")).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it("never overwrites an existing file", async () => {
    await storage.put("checks/a.pdf", Buffer.from("first"), "application/pdf");
    await expect(storage.put("checks/a.pdf", Buffer.from("second"), "application/pdf")).rejects.toThrow();
    expect((await storage.get("checks/a.pdf")).toString()).toBe("first");
  });

  it("deleting a missing file is not an error", async () => {
    await expect(storage.delete("checks/never-existed.pdf")).resolves.toBeUndefined();
  });

  it("refuses a symlink inside the folder that points outside it", async () => {
    const outside = path.join(os.tmpdir(), `outside-${process.pid}.pdf`);
    fs.writeFileSync(outside, "secret");
    fs.mkdirSync(path.join(root, "checks"), { recursive: true });
    try {
      try {
        fs.symlinkSync(outside, path.join(root, "checks", "link.pdf"));
      } catch {
        return; // Creating symlinks needs extra privileges on Windows; covered on Linux CI.
      }
      await expect(storage.get("checks/link.pdf")).rejects.toBeInstanceOf(InvalidStorageKeyError);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
