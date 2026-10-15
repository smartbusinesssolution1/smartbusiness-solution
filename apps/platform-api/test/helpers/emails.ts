import { MemoryEmailSender, type SentEmail } from "@smartbusiness/email";
import { emailSender } from "../../src/shared/services/email.js";

// The app's email sender; in tests it is the in-memory one (EMAIL_TRANSPORT=memory).
export const outbox = emailSender as MemoryEmailSender;

// Some emails are sent after the HTTP reply (forgot-password), so wait for them.
export async function waitForEmail(to: string, tag: string, timeoutMs = 3000): Promise<SentEmail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = outbox.last(to, tag);
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`No "${tag}" email to ${to} within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// Waits long enough for background work to finish, to assert that NO email was sent.
export async function settle(ms = 400): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// Pulls the token out of the link in an email's plain-text body.
export function tokenFrom(email: SentEmail, path: string): string {
  // "\\?" in a template string reaches the regex as "\?": a literal question mark.
  const match = email.text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${path} link in the "${email.tag}" email`);
  return match[1]!;
}
