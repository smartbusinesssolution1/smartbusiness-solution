import { FileEmailSender } from "./senders/file.js";
import { MemoryEmailSender } from "./senders/memory.js";
import type { EmailSender } from "./types.js";

export * from "./types.js";
export * from "./templates.js";
export { escapeHtml, safeLink } from "./escape.js";
export { FileEmailSender } from "./senders/file.js";
export { MemoryEmailSender } from "./senders/memory.js";

export type EmailTransport = "file" | "memory";

export interface EmailConfig {
  transport: EmailTransport;
  // The From address, e.g. "SmartBusiness <no-reply@smartbusiness.com>".
  from: string;
  // Required for the "file" transport: where emails are written.
  fileDirectory?: string;
  log?: (line: string) => void;
}

/**
 * Chooses the delivery for this environment. Business code receives the result as
 * an EmailSender and never knows which one it got. A real provider will be added
 * here as one more case once the client chooses it.
 */
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
    default:
      throw new Error(`Unknown email transport "${String(config.transport)}"`);
  }
}
