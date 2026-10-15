import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/index.js";
import { logger } from "./logger.js";

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
          // Supports Microsoft Outlook (smtp-mail.outlook.com / smtp.office365.com) STARTTLS
          ciphers: "SSLv3",
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

    const orgDisplayName = organizationName || "SmartBusiness Solutions";
    const roleDisplayName = role === "admin" ? "Platform Administrator" : "Standard Employee";
    const loginUrl = env.portalLoginUrl || "http://localhost:5173/login";

    const subject = `Welcome to ${orgDisplayName} - Your Access Credentials (${employeeCode})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; margin-bottom: 20px; line-height: 1.5; }
    .credential-card { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .credential-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .credential-row:last-child { border-bottom: none; }
    .credential-label { color: #64748b; font-weight: 500; }
    .credential-value { font-weight: 600; color: #0f172a; font-family: monospace, monospace; }
    .password-badge { background-color: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #fde68a; letter-spacing: 0.5px; }
    .btn-container { text-align: center; margin: 32px 0 20px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 32px; font-size: 15px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.25); }
    .notice { font-size: 13px; color: #64748b; line-height: 1.5; background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin-top: 24px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background-color: #fafafa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgDisplayName}</h1>
      <p>Corporate Attendance & Identity Management</p>
    </div>
    <div class="content">
      <p class="greeting">
        Hello <strong>${employeeName}</strong>,<br><br>
        Your corporate account has been provisioned for <strong>${orgDisplayName}</strong>${workspaceName ? ` (${workspaceName})` : ""}.
        You can now log in to the workforce portal using the credentials below:
      </p>

      <div class="credential-card">
        <div class="credential-row">
          <span class="credential-label">Portal URL:</span>
          <span class="credential-value"><a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Login Email:</span>
          <span class="credential-value">${to}</span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Employee ID:</span>
          <span class="credential-value">${employeeCode}</span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Assigned Role:</span>
          <span class="credential-value">${roleDisplayName}</span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Temporary Password:</span>
          <span class="credential-value password-badge">${temporaryPassword}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${loginUrl}" class="btn" target="_blank">Sign In to Your Account</a>
      </div>

      <div class="notice">
        <strong>🔒 Security Reminder:</strong><br>
        This temporary password was generated automatically by your administrator. For your security, please update your password after logging in for the first time.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${orgDisplayName}. All rights reserved.<br>
      This is an automated system notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Welcome to ${orgDisplayName}!

Hello ${employeeName},

Your corporate profile has been created. Here are your credentials:

- Portal Login URL: ${loginUrl}
- Login Email: ${to}
- Employee ID: ${employeeCode}
- Authorization Role: ${roleDisplayName}
- Temporary Password: ${temporaryPassword}

For your security, please change your temporary password after logging in.

Sign In: ${loginUrl}

© ${new Date().getFullYear()} ${orgDisplayName}
    `.trim();

    try {
      const transporter = await this.initTransporter();
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        text,
        html,
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
        console.log(`   Role:               ${roleDisplayName}`);
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
