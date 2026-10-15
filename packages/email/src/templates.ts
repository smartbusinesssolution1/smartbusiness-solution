import { escapeHtml, safeLink } from "./escape.js";
import type { EmailMessage } from "./types.js";

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

/** Sent after "Forgot password". */
export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailTemplate {
  const href = safeLink(input.resetUrl);
  return {
    tag: "password-reset",
    subject: `Reset your ${PRODUCT} password`,
    html: layout(
      "Reset your password",
      [
        `Hi ${escapeHtml(input.name)},`,
        `We received a request to reset your password. The link below works once and expires in ${input.expiresInMinutes} minutes.`,
        `If you didn't ask for this, you can ignore this email: your password stays the same.`,
      ],
      { label: "Choose a new password", href },
    ),
    text:
      `Hi ${input.name},\n\n` +
      `We received a request to reset your ${PRODUCT} password. This link works once and expires in ${input.expiresInMinutes} minutes:\n\n` +
      `${input.resetUrl}\n\n` +
      `If you didn't ask for this, you can ignore this email: your password stays the same.\n`,
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
