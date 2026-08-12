import { getFromAddress, getMailTransporterFromSettings, getEnvMailTransporter } from "@/lib/email/nodemailer";
import { wrapEmailHtml } from "@/lib/email/templates";
import {
  buildBrandedEmailHtml,
  buildBrandedEmailText,
  signatureFromSettings,
  resolveSignatureImageUrl,
} from "@/lib/email/signature";
import { sendViaSes } from "@/lib/email/ses";
import { injectOpenTrackingPixel } from "@/lib/email/tracking";
import { isDeliveryReady } from "@/lib/workspaces/delivery";

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
 *   trackingToken?: string | null;
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
  trackingToken,
}) {
  const signature = signatureFromSettings(settings);
  const resolvedSigImage = resolveSignatureImageUrl(settings, signatureImageUrl);
  const hasTemplateBranding = Boolean(logoUrl?.trim() || resolvedSigImage);
  const prebranded = Boolean(bodyHtml?.includes('data-email-brand="1"'));

  let htmlContent;
  let text = bodyText;

  if (hasTemplateBranding) {
    htmlContent = buildBrandedEmailHtml({
      bodyText,
      bodyHtml,
      logoUrl,
      signatureImageUrl: resolvedSigImage,
      workspaceSignature: signature,
    });
    text = buildBrandedEmailText(bodyText, signature, resolvedSigImage);
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
      signatureImageUrl: resolvedSigImage,
      workspaceSignature: signature,
    });
    text = buildBrandedEmailText(bodyText, signature, resolvedSigImage);
  }

  let html = isFullHtmlDocument(htmlContent) ? htmlContent : wrapEmailHtml(htmlContent);

  if (trackingToken) {
    html = injectOpenTrackingPixel(html, trackingToken);
  }

  const from = getFromAddress(settings || undefined);
  const usePlatform =
    settings?.sending_mode === "platform" && isDeliveryReady(settings);

  if (usePlatform) {
    await sendViaSes({
      from,
      to: recipients,
      subject,
      text,
      html,
    });
    return { html, bodyText: text };
  }

  const transporter = settings?.smtp_host
    ? getMailTransporterFromSettings(settings)
    : getEnvMailTransporter();

  await transporter.sendMail({
    from,
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
