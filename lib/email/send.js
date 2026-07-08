import { getFromAddress, getMailTransporter, getSentCopyAddress } from "@/lib/email/nodemailer";
import { wrapEmailHtml } from "@/lib/email/templates";
import { buildEmailHtml } from "@/lib/email/signature";

/**
 * @param {{ subject: string; bodyText: string; bodyHtml?: string; recipients: string[] }} params
 */
export async function deliverEmail({ subject, bodyText, bodyHtml, recipients }) {
  const htmlContent =
    bodyHtml?.includes("<p") ? bodyHtml : buildEmailHtml(bodyText, bodyHtml);
  const html = wrapEmailHtml(htmlContent);
  const transporter = getMailTransporter();
  const copyTo = getSentCopyAddress();
  const normalizedRecipients = recipients.map((email) => email.trim().toLowerCase());
  const bcc =
    copyTo && !normalizedRecipients.includes(copyTo.toLowerCase()) ? copyTo : undefined;

  await transporter.sendMail({
    from: getFromAddress(),
    to: recipients.join(", "),
    ...(bcc ? { bcc } : {}),
    subject,
    text: bodyText,
    html,
  });

  return { html, bodyText };
}

/**
 * @param {string} value
 */
export function parseRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((email) => email.trim()).filter(Boolean);
  }

  return String(value)
    .split(/[,;\n]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}
