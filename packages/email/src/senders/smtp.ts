import nodemailer, { type Transporter } from "nodemailer";
import { assertSendable, type EmailMessage, type EmailSender } from "../types.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  from: string;
  log?: (line: string) => void;
}

export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter;
  private from: string;
  private log?: (line: string) => void;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.log = config.log;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    assertSendable(message);

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });

      this.log?.(`[SMTP] Sent email "${message.tag}" to ${message.to} (MessageId: ${info.messageId})`);
    } catch (err: any) {
      this.log?.(`[SMTP ERROR] Failed to send email to ${message.to}: ${err?.message || err}`);
      throw err;
    }
  }
}
