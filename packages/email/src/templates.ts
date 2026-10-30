import { escapeHtml, safeLink } from "./escape.js";
import type { EmailMessage } from "./types.js";
import { emailAssets } from "./assets.js";

// EMAIL TEMPLATES
// Every email's wording lives here, in one reviewable place. Each template takes
// the data it needs and returns subject + HTML + plain text. Values from users are
// escaped; links must be http(s). The HTML uses inline styles because many email
// apps ignore <style> blocks.

const PRODUCT = "SmartBusiness";

export type EmailTemplate = Omit<EmailMessage, "to">;

// Subjects are a header line: user-supplied names must not break them.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function layout(
  title: string,
  paragraphs: string[],
  button?: { label: string; href: string },
): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2937">${p}</p>`,
    )
    .join("");
  const action = button
    ? `<p style="margin:22px 0"><a href="${button.href}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:6px">${escapeHtml(button.label)}</a></p>` +
    `<p style="margin:0 0 14px;font-size:13px;color:#6b7280">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${button.href}</span></p>`
    : "";
  return (
    `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif">` +
    `<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.06em;color:#2563eb">${PRODUCT.toUpperCase()}</p>` +
    `<h1 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(title)}</h1>` +
    body +
    action +
    `<p style="margin:26px 0 0;font-size:12px;color:#9ca3af">You received this email because of activity on your ${PRODUCT} account.</p>` +
    `</div>`
  );
}

/** Sent after "Forgot password" - Branded Clock-In Clock-Out & SmartBusiness Template. */
export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  playStoreUrl?: string;
  appStoreUrl?: string;
}): EmailTemplate {
  const {
    resetUrl,
    expiresInMinutes = 15,
    playStoreUrl = "#",
    appStoreUrl = "#",
  } = input;
  const safeResetUrl = safeLink(resetUrl);

  const subject = `Reset Your Password - SmartBusiness`;
  const font = `'Segoe UI', Arial, Helvetica, sans-serif`;

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, a, div, span {
      font-family: 'Segoe UI', Arial, sans-serif !important;
    }
  </style>
  <![endif]-->

  <style type="text/css">
    body, table, td, h1, p, a, div, span {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ebf3fb !important;
      -webkit-font-smoothing: antialiased !important;
    }
    table {
      border-collapse: separate !important;
    }
    img {
      border: 0 !important;
      outline: none !important;
      text-decoration: none !important;
      -ms-interpolation-mode: bicubic;
    }
    @media only screen and (max-width: 620px) {
      .card-wrap {
        padding: 24px 16px !important;
        border-radius: 18px !important;
      }
      .main-title {
        font-size: 26px !important;
      }
      .logo-title {
        font-size: 16px !important;
      }
      .logo-sub {
        font-size: 13px !important;
      }
      .app-button {
        display: block !important;
        margin: 6px auto !important;
      }
    }
  </style>
</head>
<body bgcolor="#ebf3fb" style="margin: 0; padding: 0; background-color: #ebf3fb; font-family: ${font}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

  <!-- Background Wrapper -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ebf3fb" style="width: 100%; background-color: #ebf3fb !important; margin: 0; padding: 36px 12px; font-family: ${font};">
    <tr>
      <td align="center" bgcolor="#ebf3fb" style="background-color: #ebf3fb !important; font-family: ${font};">
        
        <!-- Center Main White Card -->
        <table width="640" class="card-wrap" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width: 640px; width: 100%; background-color: #ffffff !important; border-radius: 26px; border: 1px solid #d2e4f7; box-shadow: 0 12px 40px rgba(37,99,235,0.08); overflow: hidden; margin: 0 auto; font-family: ${font};">
          <tr>
            <td bgcolor="#ffffff" style="padding: 38px 44px 44px 44px; background-color: #ffffff !important; font-family: ${font};">
              
              <!-- Header Row: Both Logos -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                <tr>
                  <!-- Left: SmartBusiness Solutions -->
                  <td align="left" valign="middle" style="font-family: ${font}; text-align: left;">
                    <table border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                      <tr>
                        <td valign="middle" style="width: 44px; font-family: ${font};">
                          <img src="cid:smart-logo@smartbusiness.com" width="44" height="44" border="0" alt="" style="display: block; border-radius: 10px; border: 0; width: 44px; height: 44px;" />
                        </td>
                        <td valign="middle" style="padding-left: 10px; font-family: ${font}; text-align: left;">
                          <div class="logo-title" style="font-family: ${font}; font-size: 18px; font-weight: 800; color: #000000; line-height: 1.15; letter-spacing: -0.3px;">SmartBusiness</div>
                          <div class="logo-sub" style="font-family: ${font}; font-size: 15px; font-weight: 700; color: #4338ca; line-height: 1.15;">Solutions</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Clock In Clock Out -->
                  <td align="right" valign="middle" style="font-family: ${font}; text-align: right;">
                    <table border="0" cellspacing="0" cellpadding="0" style="margin-left: auto; font-family: ${font};">
                      <tr>
                        <td valign="middle" style="width: 44px; font-family: ${font};">
                          <img src="cid:clockin-logo@smartbusiness.com" width="44" height="44" border="0" alt="" style="display: block; border-radius: 10px; border: 0; width: 44px; height: 44px;" />
                        </td>
                        <td valign="middle" style="padding-left: 10px; font-family: ${font}; text-align: left;">
                          <div class="logo-title" style="font-family: ${font}; font-size: 18px; font-weight: 800; color: #000000; line-height: 1.15; letter-spacing: -0.3px;">Clock In</div>
                          <div class="logo-sub" style="font-family: ${font}; font-size: 15px; font-weight: 700; color: #6366f1; line-height: 1.15;">Clock Out</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Main Title & Subtitle -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 42px; font-family: ${font};">
                <tr>
                  <td align="center" style="font-family: ${font}; text-align: center;">
                    <h1 class="main-title" style="margin: 0; font-family: ${font}; font-size: 34px; font-weight: 800; color: #000000; letter-spacing: -0.8px; line-height: 1.2;">
                      Reset Your <span style="color: #0066ff;">Password</span>
                    </h1>
                    <p style="margin: 12px auto 34px auto; font-family: ${font}; font-size: 14px; color: #556476; line-height: 1.6; max-width: 480px; font-weight: 400;">
                      We received a request to reset your password. Please find your secure reset link below to choose a new password for your account. This link will expire in ${expiresInMinutes} minutes.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Primary Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; font-family: ${font};">
                <tr>
                  <td align="center" style="font-family: ${font}; text-align: center;">
                    <a href="${safeResetUrl}" target="_blank" style="display: inline-block; background-color: #0066ff; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link Row Card (Only link row, username & password removed as requested) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                <tr>
                  <td style="padding-bottom: 34px; font-family: ${font};">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#edf5fd" style="background-color: #edf5fd !important; border-radius: 12px; border: 1px solid #d9eaf9; padding: 14px 18px; font-family: ${font};">
                      <tr>
                        <td width="34" valign="middle" bgcolor="#edf5fd" style="width: 34px; background-color: #edf5fd !important; font-family: ${font};">
                          <img src="cid:link-icon@smartbusiness.com" width="34" height="34" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 34px; height: 34px;" />
                        </td>
                        <td width="110" valign="middle" bgcolor="#edf5fd" style="width: 110px; background-color: #edf5fd !important; padding-left: 14px; font-family: ${font}; font-size: 14px; font-weight: 700; color: #0f172a;">
                          Reset URL
                        </td>
                        <td valign="middle" bgcolor="#edf5fd" style="background-color: #edf5fd !important; font-family: ${font};">
                          <a href="${safeResetUrl}" target="_blank" style="font-family: ${font}; font-size: 14px; color: #0066ff; text-decoration: none; font-weight: 600; word-break: break-all;">
                            ${safeResetUrl}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Download Mobile App Section -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                <tr>
                  <td align="center" style="padding-bottom: 14px; font-family: ${font}; text-align: center;">
                    <div style="font-family: ${font}; font-size: 11px; font-weight: 800; color: #556476; letter-spacing: 0.8px; text-transform: uppercase;">
                      DOWNLOAD THESE MOBILE APP
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: ${font}; text-align: center;">
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; font-family: ${font};">
                      <tr>
                        <td style="padding: 0 6px;">
                          <a href="${playStoreUrl}" class="app-button" style="text-decoration: none; display: inline-block;">
                            <img src="cid:google-play@smartbusiness.com" width="148" height="44" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 148px; height: 44px;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="${appStoreUrl}" class="app-button" style="text-decoration: none; display: inline-block;">
                            <img src="cid:app-store@smartbusiness.com" width="148" height="44" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 148px; height: 44px;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Reset Your Password - SmartBusiness

We received a request to reset your password. Please find your secure reset link below to choose a new password for your account:

- Reset Link: ${safeResetUrl}

This link works once and expires in ${expiresInMinutes} minutes.
If you didn't ask for this, you can safely ignore this email.

Download our mobile app on Google Play or App Store.
  `.trim();

  const attachments = [
    {
      filename: "smart-logo.png",
      content: emailAssets.smartLogo,
      cid: "smart-logo@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "clockin-logo.png",
      content: emailAssets.clockinLogo,
      cid: "clockin-logo@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "link-icon.png",
      content: emailAssets.linkIcon,
      cid: "link-icon@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "google-play.png",
      content: emailAssets.googlePlay,
      cid: "google-play@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "app-store.png",
      content: emailAssets.appStore,
      cid: "app-store@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
  ];

  return {
    tag: "password-reset",
    subject,
    html,
    text,
    attachments,
  };
}

// Sent once after a company signs up on the portal. Never contains a password: they chose
// it and know it, and an email stays in inboxes, syncs to phones and gets forwarded. It only
// confirms the account and links back to the app they signed up on.
export function welcomeEmail(input: {
  name: string;
  companyName: string;
  email: string;
  appUrl: string;
}): EmailTemplate {
  const href = safeLink(input.appUrl);
  return {
    tag: "welcome",
    subject: oneLine(`Welcome to ${PRODUCT}, ${input.companyName}`),
    html: layout(
      `Welcome to ${PRODUCT}`,
      [
        `Hi ${escapeHtml(input.name)},`,
        `Your ${PRODUCT} account for <strong>${escapeHtml(input.companyName)}</strong> is ready.`,
        `Sign in with this email address (${escapeHtml(input.email)}) and the password you chose. One account opens every ${PRODUCT} product your company uses.`,
        `If you didn't create this account, you can ignore this email.`,
      ],
      { label: `Open ${PRODUCT}`, href },
    ),
    text:
      `Hi ${input.name},\n\n` +
      `Your ${PRODUCT} account for ${input.companyName} is ready.\n\n` +
      `Sign in with this email address (${input.email}) and the password you chose. One account opens every ${PRODUCT} product your company uses:\n\n` +
      `${input.appUrl}\n\n` +
      `If you didn't create this account, you can ignore this email.\n`,
  };
}

/** Sent after a password was changed, so the owner notices if it wasn't them. */
export function passwordChangedEmail(input: {
  name: string;
  changedAt: Date;
}): EmailTemplate {
  const when = input.changedAt.toUTCString();
  return {
    tag: "password-changed",
    subject: `Your ${PRODUCT} password was changed`,
    html: layout("Your password was changed", [
      `Hi ${escapeHtml(input.name)},`,
      `The password for your account was changed on ${escapeHtml(when)}. You have been signed out on every device.`,
      `If this wasn't you, reset your password right away and tell your administrator.`,
    ]),
    text:
      `Hi ${input.name},\n\n` +
      `The password for your ${PRODUCT} account was changed on ${when}. You have been signed out on every device.\n\n` +
      `If this wasn't you, reset your password right away and tell your administrator.\n`,
  };
}

/** Sent to someone who doesn't have an account yet. */
export function invitationEmail(input: {
  inviteeName: string;
  inviterName: string;
  companyName: string;
  workspaceName: string;
  acceptUrl: string;
  expiresInDays: number;
}): EmailTemplate {
  const href = safeLink(input.acceptUrl);
  return {
    tag: "invitation",
    subject: oneLine(
      `${input.inviterName} invited you to ${input.workspaceName} on ${PRODUCT}`,
    ),
    html: layout(
      `You're invited to ${input.workspaceName}`,
      [
        `Hi ${escapeHtml(input.inviteeName)},`,
        `${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong> (${escapeHtml(input.companyName)}) on ${PRODUCT}.`,
        `Set your password to get started. This invitation expires in ${input.expiresInDays} days.`,
      ],
      { label: "Accept invitation", href },
    ),
    text:
      `Hi ${input.inviteeName},\n\n` +
      `${input.inviterName} invited you to join ${input.workspaceName} (${input.companyName}) on ${PRODUCT}.\n\n` +
      `Set your password to get started. This invitation expires in ${input.expiresInDays} days:\n\n` +
      `${input.acceptUrl}\n`,
  };
}

/** Sent to someone who already has an account and was added to another workspace. */
export function addedToWorkspaceEmail(input: {
  name: string;
  inviterName: string;
  companyName: string;
  workspaceName: string;
  signInUrl: string;
}): EmailTemplate {
  const href = safeLink(input.signInUrl);
  return {
    tag: "added-to-workspace",
    subject: oneLine(
      `You now have access to ${input.workspaceName} on ${PRODUCT}`,
    ),
    html: layout(
      `You now have access to ${input.workspaceName}`,
      [
        `Hi ${escapeHtml(input.name)},`,
        `${escapeHtml(input.inviterName)} added you to <strong>${escapeHtml(input.workspaceName)}</strong> (${escapeHtml(input.companyName)}). Sign in with your existing password to see it.`,
        `If you don't recognise this, tell your administrator.`,
      ],
      { label: "Sign in", href },
    ),
    text:
      `Hi ${input.name},\n\n` +
      `${input.inviterName} added you to ${input.workspaceName} (${input.companyName}) on ${PRODUCT}. Sign in with your existing password to see it:\n\n` +
      `${input.signInUrl}\n\n` +
      `If you don't recognise this, tell your administrator.\n`,
  };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Check approvals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// The check is named by number, amount and payee so it can be recognised from the inbox.
// Never a bank or account number, and the link only opens the check: it does not sign in.

interface CheckSummary {
  checkNumber: string;
  amount: string; // "$9,000.00"
  payeeName: string;
  workspaceName: string;
  checkUrl: string;
}

const checkLabel = (c: CheckSummary) => `check #${c.checkNumber} · ${c.amount} to ${c.payeeName}`;

/** Sent to each person who can approve a check that is waiting for approval. */
export function approvalRequestEmail(input: CheckSummary & {
  approverName: string;
  writerName: string;
  memo: string | null;
  approvalsNeeded: number;
}): EmailTemplate {
  const href = safeLink(input.checkUrl);
  const needs = input.approvalsNeeded > 1 ? ` It needs ${input.approvalsNeeded} approvals.` : "";
  const memo = input.memo ? ` Memo: "${input.memo}".` : "";
  return {
    tag: "approval-request",
    subject: oneLine(`Approval needed: ${checkLabel(input)}`),
    html: layout(
      `A check needs your approval`,
      [
        `Hi ${escapeHtml(input.approverName)},`,
        `${escapeHtml(input.writerName)} wrote <strong>check #${escapeHtml(input.checkNumber)}</strong> for <strong>${escapeHtml(input.amount)}</strong> to <strong>${escapeHtml(input.payeeName)}</strong> in ${escapeHtml(input.workspaceName)}.${escapeHtml(memo)}`,
        `Review it and approve or reject it.${escapeHtml(needs)}`,
      ],
      { label: "Review the check", href },
    ),
    text:
      `Hi ${input.approverName},\n\n` +
      `${input.writerName} wrote check #${input.checkNumber} for ${input.amount} to ${input.payeeName} in ${input.workspaceName}.${memo}\n\n` +
      `Review it and approve or reject it.${needs}\n\n` +
      `${input.checkUrl}\n`,
  };
}

/** Sent to the writer when their check has every approval it needs. */
export function checkApprovedEmail(input: CheckSummary & { writerName: string }): EmailTemplate {
  const href = safeLink(input.checkUrl);
  return {
    tag: "check-approved",
    subject: oneLine(`Approved: ${checkLabel(input)}`),
    html: layout(
      `Check #${input.checkNumber} was approved`,
      [
        `Hi ${escapeHtml(input.writerName)},`,
        `Your <strong>check #${escapeHtml(input.checkNumber)}</strong> for <strong>${escapeHtml(input.amount)}</strong> to <strong>${escapeHtml(input.payeeName)}</strong> in ${escapeHtml(input.workspaceName)} has every approval it needs. It is ready to print.`,
      ],
      { label: "Open the check", href },
    ),
    text:
      `Hi ${input.writerName},\n\n` +
      `Your check #${input.checkNumber} for ${input.amount} to ${input.payeeName} in ${input.workspaceName} has every approval it needs. It is ready to print.\n\n` +
      `${input.checkUrl}\n`,
  };
}

/** Sent to the writer when an approver rejects their check, with the reason. */
export function checkRejectedEmail(input: CheckSummary & { writerName: string; rejectedBy: string; reason: string }): EmailTemplate {
  const href = safeLink(input.checkUrl);
  return {
    tag: "check-rejected",
    subject: oneLine(`Rejected: ${checkLabel(input)}`),
    html: layout(
      `Check #${input.checkNumber} was rejected`,
      [
        `Hi ${escapeHtml(input.writerName)},`,
        `${escapeHtml(input.rejectedBy)} rejected your <strong>check #${escapeHtml(input.checkNumber)}</strong> for <strong>${escapeHtml(input.amount)}</strong> to <strong>${escapeHtml(input.payeeName)}</strong> in ${escapeHtml(input.workspaceName)}.`,
        `Reason: ${escapeHtml(input.reason)}`,
        `Fix the check and send it for approval again, or close it if it's no longer needed.`,
      ],
      { label: "Fix the check", href },
    ),
    text:
      `Hi ${input.writerName},\n\n` +
      `${input.rejectedBy} rejected your check #${input.checkNumber} for ${input.amount} to ${input.payeeName} in ${input.workspaceName}.\n\n` +
      `Reason: ${input.reason}\n\n` +
      `Fix the check and send it for approval again, or close it if it's no longer needed:\n\n` +
      `${input.checkUrl}\n`,
  };
}
