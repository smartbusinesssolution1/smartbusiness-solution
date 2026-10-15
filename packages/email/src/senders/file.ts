import * as fs from "fs/promises";
import * as path from "path";
import { escapeHtml } from "../escape.js";
import {
  assertSendable,
  type EmailMessage,
  type EmailSender,
} from "../types.js";

// Development delivery: writes each email to a folder as an .html file you can open
// in a browser (links are clickable) plus a .txt file with the plain-text version.
// Nothing leaves the machine.

export class FileEmailSender implements EmailSender {
  constructor(
    private readonly from: string,
    private readonly directory: string,
    private readonly log: (line: string) => void = () => {},
  ) {}

  async send(message: EmailMessage): Promise<void> {
    assertSendable(message);
    await fs.mkdir(this.directory, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTo = message.to.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const base = path.join(this.directory, `${stamp}_${message.tag}_${safeTo}`);

    const header = [
      `From: ${this.from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      `Tag: ${message.tag}`,
    ];

    const htmlFile =
      `<!-- ${header.map(escapeHtml).join(" | ")} -->\n` +
      `<div style="font:13px monospace;background:#f3f4f6;padding:10px;border-bottom:1px solid #d1d5db">` +
      header.map((h) => escapeHtml(h)).join("<br>") +
      `</div>\n` +
      message.html;

    await fs.writeFile(`${base}.html`, htmlFile, "utf8");
    await fs.writeFile(
      `${base}.txt`,
      `${header.join("\n")}\n\n${message.text}`,
      "utf8",
    );

    this.log(`Email "${message.tag}" to ${message.to} written to ${base}.html`);
  }
}
