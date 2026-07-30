import { getFromAddress, getMailTransporterFromSettings, getEnvMailTransporter } from "@/lib/email/nodemailer";
import { wrapEmailHtml } from "@/lib/email/templates";
import { buildEmailHtml } from "@/lib/email/signature";

/**
 * @param {{
 *   subject: string;
 *   bodyText: string;
 *   bodyHtml?: string;
 *   recipients: string[];
 *   settings?: Record<string, unknown> | null;
 * }} params
 */
export async function deliverEmail({ subject, bodyText, bodyHtml, recipients, settings }) {
  const signature = settings
    ? {
        text: String(settings.signature_text || ""),
        html: String(settings.signature_html || ""),
      }
    : null;

  const htmlContent =
    bodyHtml?.includes("<p")
      ? bodyHtml
      : buildEmailHtml(bodyText, bodyHtml, signature);
  const html = wrapEmailHtml(htmlContent);

  const transporter = settings?.smtp_host
    ? getMailTransporterFromSettings(settings)
    : getEnvMailTransporter();

  await transporter.sendMail({
    from: getFromAddress(settings || undefined),
    to: recipients.join(", "),
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
