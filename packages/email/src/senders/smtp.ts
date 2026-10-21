import nodemailer, { type Transporter } from "nodemailer";
import { assertSendable, type EmailMessage, type EmailSender } from "../types.js";

// Real delivery over SMTP. Locally this points at Mailpit (a fake inbox in Docker);
// in production at AWS SES, whose SMTP endpoint takes the same settings
// (host email-smtp.<region>.amazonaws.com, port 587, SES SMTP credentials).

export interface SmtpSettings {
  host: string;
  port: number;
  // true: TLS from the first byte (port 465). false: plain connection upgraded with
  // STARTTLS when the server offers it (port 587, or Mailpit's 1025).
  secure: boolean;
  // Refuse to send unless the connection was upgraded to TLS (set for real providers).
  requireTls: boolean;
  user?: string;
  pass?: string;
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    settings: SmtpSettings,
    private readonly log: (line: string) => void = () => {},
  ) {
    this.transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: settings.requireTls,
      auth: settings.user ? { user: settings.user, pass: settings.pass ?? "" } : undefined,
      // Fail fast instead of holding a queue worker for minutes on a dead server;
      // the job is retried later.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    assertSendable(message);
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      // Shows up in the provider's logs, so a bounce can be traced to the kind of email.
      headers: { "X-SmartBusiness-Email": message.tag },
    });
    this.log(`Email "${message.tag}" to ${message.to} sent over SMTP (${info.messageId})`);
  }
}
