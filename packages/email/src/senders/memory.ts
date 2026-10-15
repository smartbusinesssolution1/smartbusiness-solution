import {
  assertSendable,
  type EmailMessage,
  type EmailSender,
  type SentEmail,
} from "../types.js";

//Keeps every email in a list instead of delivering it. Used by automated tests,
//which read the list to check that the right email went to the right person and
//to pull links out of it.

export class MemoryEmailSender implements EmailSender {
  readonly sent: SentEmail[] = [];

  constructor(private readonly from: string) {}

  async send(message: EmailMessage): Promise<void> {
    assertSendable(message);
    this.sent.push({ ...message, from: this.from, sentAt: new Date() });
  }

  // Emails sent to `to`, optionally only of one kind, oldest first.
  to(to: string, tag?: string): SentEmail[] {
    return this.sent.filter(
      (e) => e.to === to && (tag === undefined || e.tag === tag),
    );
  }

  // The most recent email sent to `to` (optionally of one kind), or undefined.
  last(to: string, tag?: string): SentEmail | undefined {
    return this.to(to, tag).at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
