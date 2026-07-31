import { getFromAddress, getMailTransporterFromSettings, getEnvMailTransporter } from "@/lib/email/nodemailer";
import { wrapEmailHtml } from "@/lib/email/templates";
import {
  buildBrandedEmailHtml,
  buildBrandedEmailText,
  signatureFromSettings,
} from "@/lib/email/signature";

/**
 * @param {string | null | undefined} html
 */
function isFullHtmlDocument(html) {
  return Boolean(html && /<!DOCTYPE html|<html[\s>]/i.test(html));
}

/**
 * @param {{
 *   subject: string;
 *   bodyText: string;
 *   bodyHtml?: string;
 *   recipients: string[];
 *   settings?: Record<string, unknown> | null;
 *   logoUrl?: string | null;
 *   signatureImageUrl?: string | null;
 * }} params
 */
export async function deliverEmail({
  subject,
  bodyText,
  bodyHtml,
  recipients,
  settings,
  logoUrl,
  signatureImageUrl,
}) {
  const signature = signatureFromSettings(settings);
  const hasTemplateBranding = Boolean(logoUrl?.trim() || signatureImageUrl?.trim());
  const prebranded = Boolean(bodyHtml?.includes('data-email-brand="1"'));

  let htmlContent;
  let text = bodyText;

  if (hasTemplateBranding) {
    htmlContent = buildBrandedEmailHtml({
      bodyText,
      bodyHtml,
      logoUrl,
      signatureImageUrl,
      workspaceSignature: signature,
    });
    text = buildBrandedEmailText(bodyText, signature, signatureImageUrl);
  } else if (prebranded) {
    htmlContent = bodyHtml;
    text = buildBrandedEmailText(bodyText, signature, null);
  } else if (isFullHtmlDocument(bodyHtml)) {
    htmlContent = bodyHtml;
  } else if (bodyHtml?.includes("<p")) {
    htmlContent = bodyHtml;
  } else {
    htmlContent = buildBrandedEmailHtml({
      bodyText,
      bodyHtml,
      workspaceSignature: signature,
    });
    text = buildBrandedEmailText(bodyText, signature, null);
  }

  const html = isFullHtmlDocument(htmlContent) ? htmlContent : wrapEmailHtml(htmlContent);

  const transporter = settings?.smtp_host
    ? getMailTransporterFromSettings(settings)
    : getEnvMailTransporter();

  await transporter.sendMail({
    from: getFromAddress(settings || undefined),
    to: recipients.join(", "),
    subject,
    text,
    html,
  });

  return { html, bodyText: text };
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
