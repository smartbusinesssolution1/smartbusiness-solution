// One email attachment for inline CID or downloadable files.
export interface EmailAttachment {
  filename: string;
  content: any;
  cid?: string;
  contentType?: string;
  contentDisposition?: "inline" | "attachment";
}

// One email, ready to send. Every email has an HTML and a plain-text body.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  // What kind of email this is ("password-reset", "invitation"…): for logs, tests and analytics.
  tag: string;
  attachments?: EmailAttachment[];
}

// An email as it was handed to a sender, with the sender's From address and the time.
export interface SentEmail extends EmailMessage {
  from: string;
  sentAt: Date;
}

// The one thing business code knows about email: something that can send it.
// Which implementation is plugged in (a folder, a list in memory, a real provider)
// is chosen once, in configuration.

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// Thrown when a message is unsafe or incomplete; never silently "fixed".
export class EmailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailValidationError";
  }
}

// One address: something@something.tld, with no spaces, commas or line breaks.
const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// Checks a message before any sender touches it. Header fields (to, subject) must not
// contain line breaks: in an email header each line is a field, so a line break inside
// a value would let someone add their own fields, such as a hidden Bcc.

export function assertSendable(message: EmailMessage): void {
  if (!SINGLE_ADDRESS.test(message.to)) {
    throw new EmailValidationError(`"to" must be exactly one email address`);
  }
  if (/[\r\n]/.test(message.subject)) {
    throw new EmailValidationError("The subject must not contain line breaks");
  }
  if (
    !message.subject.trim() ||
    !message.html.trim() ||
    !message.text.trim() ||
    !message.tag.trim()
  ) {
    throw new EmailValidationError(
      "subject, html, text and tag are all required",
    );
  }
}
