import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/index.js";
import { logger } from "./logger.js";
import { renderWelcomeEmail } from "../templates/welcome-email.template.js";

export interface SendEmployeeWelcomeEmailParams {
  to: string;
  employeeName: string;
  employeeCode: string;
  role: "admin" | "employee";
  temporaryPassword: string;
  organizationName?: string;
  workspaceName?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isTestTransporter = false;

  constructor() {
    this.initTransporter().catch((err) => {
      logger.warn({ err }, "Email transporter initialization warning");
    });
  }

  /**
   * Initializes the Nodemailer transport.
   * If real SMTP credentials are provided, connects to Outlook/Microsoft/Gmail/SES.
   * Otherwise, provisions an Ethereal test account or console fallback for free dev testing.
   */
  private async initTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (env.smtp.host && env.smtp.user && env.smtp.pass) {
      logger.info(
        { host: env.smtp.host, port: env.smtp.port, user: env.smtp.user },
        "Initializing production/configured SMTP transporter"
      );

      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure ?? env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.isTestTransporter = false;
      return this.transporter;
    }

    // Fallback for Local Dev / Testing: Ethereal test inbox or console transport
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.isTestTransporter = true;
      logger.info({ user: testAccount.user }, "Ethereal dev email transport ready");
      return this.transporter;
    } catch {
      logger.info(
        "No SMTP configured in .env. Using local console email transport (credentials will be printed in terminal on employee creation)."
      );
      // JSON transport fallback (won't crash)
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.isTestTransporter = true;
      return this.transporter;
    }
  }

  /**
   * Dispatches the welcome and credential onboarding email to the employee.
   */
  async sendEmployeeWelcomeEmail(params: SendEmployeeWelcomeEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    previewUrl?: string | false;
  }> {
    const { to, employeeName, employeeCode, role, temporaryPassword, organizationName, workspaceName } = params;

    const loginUrl = env.portalLoginUrl || "http://localhost:5173/login";

    const { subject, html, text, attachments } = renderWelcomeEmail({
      to,
      employeeName,
      employeeCode,
      temporaryPassword,
      loginUrl,
    });

    try {
      const transporter = await this.initTransporter();
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        text,
        html,
        attachments,
      });

      let previewUrl: string | false = false;
      if (this.isTestTransporter) {
        previewUrl = nodemailer.getTestMessageUrl(info);
      }

      logger.info(
        {
          messageId: info.messageId,
          to,
          employeeCode,
          ...(previewUrl ? { previewUrl } : {}),
        },
        "Employee welcome & credentials email dispatched successfully"
      );

      // Print clean dev console banner when using test transporter
      if (this.isTestTransporter) {
        console.log("\n=======================================================");
        console.log(`📧 [EMPLOYEE CREDENTIALS EMAIL DISPATCHED]`);
        console.log(`   To:                 ${to}`);
        console.log(`   Employee:           ${employeeName} (${employeeCode})`);
        console.log(`   Role:               ${role === "admin" ? "Platform Administrator" : "Standard Employee"}`);
        console.log(`   Temporary Password: ${temporaryPassword}`);
        console.log(`   Portal URL:         ${loginUrl}`);
        if (previewUrl) {
          console.log(`   🌐 Free Preview URL: ${previewUrl}`);
        }
        console.log("=======================================================\n");
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (err: any) {
      logger.error({ err, to }, "Failed to deliver employee welcome email");
      // Do not throw so employee registration can still complete successfully
      return {
        success: false,
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
