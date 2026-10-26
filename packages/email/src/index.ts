import { FileEmailSender } from "./senders/file.js";
import { MemoryEmailSender } from "./senders/memory.js";
import { SmtpEmailSender, type SmtpConfig } from "./senders/smtp.js";
import type { EmailSender } from "./types.js";

export * from "./types.js";
export * from "./templates.js";
export { escapeHtml, safeLink } from "./escape.js";
export { FileEmailSender } from "./senders/file.js";
export { MemoryEmailSender } from "./senders/memory.js";
export { SmtpEmailSender, type SmtpConfig } from "./senders/smtp.js";

export type EmailTransport = "file" | "memory" | "smtp";

export interface EmailConfig {
  transport: EmailTransport;
  // The From address, e.g. "SmartBusiness <no-reply@smartbusiness.com>".
  from: string;
  // Required for the "file" transport: where emails are written.
  fileDirectory?: string;
  log?: (line: string) => void;
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass: string;
  };
}

// Chooses the delivery for this environment. Business code receives the result as
// an EmailSender and never knows which one it got.

export function createEmailSender(config: EmailConfig): EmailSender {
  switch (config.transport) {
    case "file":
      if (!config.fileDirectory) {
        throw new Error(
          'EMAIL_TRANSPORT "file" needs a directory (EMAIL_FILE_DIRECTORY)',
        );
      }
      return new FileEmailSender(config.from, config.fileDirectory, config.log);
    case "memory":
      return new MemoryEmailSender(config.from);
    case "smtp":
      if (!config.smtp || !config.smtp.host || !config.smtp.user || !config.smtp.pass) {
        throw new Error(
          'EMAIL_TRANSPORT "smtp" requires SMTP configuration (host, user, pass)',
        );
      }
      return new SmtpEmailSender({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        user: config.smtp.user,
        pass: config.smtp.pass,
        from: config.from,
        log: config.log,
      });
    default:
      throw new Error(`Unknown email transport "${String(config.transport)}"`);
  }
}
