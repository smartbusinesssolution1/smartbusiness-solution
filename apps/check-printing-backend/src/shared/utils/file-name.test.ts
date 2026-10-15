import { describe, expect, it } from "vitest";
import { attachmentDisposition, cleanFileName } from "./file-name.js";
import { detectFileType } from "./file-type.js";

describe("cleanFileName", () => {
  it.each([
    ["invoice_sept.pdf", "pdf", "invoice_sept.pdf"],
    ["Invoice Sept.PDF", "pdf", "Invoice Sept.pdf"],
    ["../../etc/passwd", "pdf", "passwd.pdf"],
    ["C:\\Users\\maria\\Desktop\\receipt.jpg", "jpg", "receipt.jpg"],
    ['bad"name\r\nX-Injected: yes.pdf', "pdf", "bad name X-Injected yes.pdf"],
    [".htaccess", "pdf", "htaccess.pdf"],
    ["", "png", "attachment.png"],
    [undefined, "pdf", "attachment.pdf"],
    ["photo.exe", "jpg", "photo.jpg"],
  ])("%j → %s", (input, ext, expected) => {
    expect(cleanFileName(input as string | undefined, ext)).toBe(expected);
  });

  it("keeps names to 150 characters including the extension", () => {
    const name = cleanFileName("x".repeat(400) + ".pdf", "pdf");
    expect(name).toHaveLength(150);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("keeps non-English names", () => {
    expect(cleanFileName("Factura Señor Ramírez.pdf", "pdf")).toBe("Factura Señor Ramírez.pdf");
  });
});

describe("attachmentDisposition", () => {
  it("always downloads, with a safe ASCII name and the exact name encoded", () => {
    expect(attachmentDisposition("Factura Señor.pdf")).toBe(
      `attachment; filename="Factura Se_or.pdf"; filename*=UTF-8''Factura%20Se%C3%B1or.pdf`,
    );
  });

  it("can never break out of the header", () => {
    const header = attachmentDisposition('a"b\\c.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith('attachment; filename="a_b_c.pdf"')).toBe(true);
  });
});

describe("detectFileType", () => {
  it.each([
    ["%PDF-1.7\n...", "pdf"],
    ["GIF89a", null],
    ["PK\u0003\u0004 (a .docx or .zip)", null],
    ["<svg xmlns=...>", null],
    ["<html><script>", null],
  ])("%j → %s", (start, expected) => {
    expect(detectFileType(Buffer.from(start, "latin1"))).toBe(expected);
  });
});
