import {
  formatEmailBody,
  splitBodyAndSignature,
  bodyTextIncludesSignature,
  stripSignatureBlock,
} from "@/lib/email/format-body";

export const DEFAULT_SIGNATURE_TEXT = `Best Regards,
{{fromName}}`;

/**
 * @param {{ text?: string; html?: string; fromName?: string } | null} [signature]
 */
function resolveSignature(signature) {
  const fromName = signature?.fromName || "Team";
  const text =
    signature?.text?.trim() ||
    DEFAULT_SIGNATURE_TEXT.replace("{{fromName}}", fromName);
  const html =
    signature?.html?.trim() ||
    `<p style="margin: 16px 0 0 0; line-height: 1.6;">${text
      .split("\n")
      .map((line) => escapeHtml(line))
      .join("<br>")}</p>`;

  return { text, html };
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} url
 * @param {string} alt
 * @param {number} maxWidth
 */
function brandingImageHtml(url, alt, maxWidth) {
  const safeUrl = escapeHtml(url);
  const safeAlt = escapeHtml(alt);
  return `<img src="${safeUrl}" alt="${safeAlt}" width="${maxWidth}" style="display:block;max-width:${maxWidth}px;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

/**
 * Build email HTML with optional per-template logo + signature image.
 * Signature image replaces the workspace text signature when present.
 *
 * @param {{
 *   bodyText: string;
 *   bodyHtml?: string;
 *   logoUrl?: string | null;
 *   signatureImageUrl?: string | null;
 *   workspaceSignature?: { text?: string; html?: string; fromName?: string } | null;
 * }} params
 */
export function buildBrandedEmailHtml({
  bodyText,
  bodyHtml,
  logoUrl,
  signatureImageUrl,
  workspaceSignature,
}) {
  const logo = logoUrl?.trim() || "";
  const sigImage = signatureImageUrl?.trim() || "";

  let mainHtml;

  if (!sigImage) {
    const fullText = appendEmailSignature(bodyText, workspaceSignature);
    const { main } = splitBodyAndSignature(fullText);
    mainHtml = formatEmailBody(main, bodyHtml).bodyHtml;
  } else {
    const main = stripSignatureBlock(formatEmailBody(bodyText, "").bodyText);
    mainHtml = formatEmailBody(main, bodyHtml).bodyHtml;
  }

  const parts = ['<div data-email-brand="1">'];

  if (logo) {
    parts.push(
      `<div style="margin: 0 0 24px 0;">${brandingImageHtml(logo, "Company logo", 180)}</div>`
    );
  }

  parts.push(mainHtml);

  if (sigImage) {
    parts.push(
      `<div style="margin: 24px 0 0 0;">${brandingImageHtml(sigImage, "Email signature", 320)}</div>`
    );
  } else {
    const resolved = resolveSignature(workspaceSignature);
    parts.push(resolved.html);
  }

  parts.push("</div>");
  return parts.join("\n");
}

/**
 * Plain-text companion for branded emails.
 * @param {string} bodyText
 * @param {{ text?: string; html?: string; fromName?: string } | null} [workspaceSignature]
 * @param {string | null} [signatureImageUrl]
 */
export function buildBrandedEmailText(bodyText, workspaceSignature, signatureImageUrl) {
  if (signatureImageUrl?.trim()) {
    return stripSignatureBlock(formatEmailBody(bodyText, "").bodyText);
  }
  return appendEmailSignature(bodyText, workspaceSignature);
}

/**
 * @param {string} bodyText
 * @param {{ text?: string; html?: string; fromName?: string } | null} [signature]
 */
export function appendEmailSignature(bodyText, signature) {
  const formatted = formatEmailBody(bodyText, "").bodyText;
  const resolved = resolveSignature(signature);

  if (bodyTextIncludesSignature(formatted) || formatted.includes(resolved.text.split("\n")[0])) {
    return formatted;
  }

  return `${formatted}\n\n${resolved.text}`;
}

/**
 * @param {string} bodyText
 * @param {string} [bodyHtml]
 * @param {{ text?: string; html?: string; fromName?: string } | null} [signature]
 */
export function buildEmailHtml(bodyText, bodyHtml, signature) {
  return buildBrandedEmailHtml({
    bodyText,
    bodyHtml,
    workspaceSignature: signature,
  });
}

/**
 * @param {{ bodyText: string; bodyHtml?: string }} email
 * @param {{ text?: string; html?: string; fromName?: string } | null} [signature]
 */
export function withEmailSignature(email, signature) {
  const bodyText = appendEmailSignature(email.bodyText, signature);
  const bodyHtml = buildEmailHtml(email.bodyText, email.bodyHtml, signature);

  return { bodyText, bodyHtml };
}

/**
 * Build signature object from workspace settings row.
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function signatureFromSettings(settings) {
  if (!settings) return null;
  return {
    text: String(settings.signature_text || ""),
    html: String(settings.signature_html || ""),
    fromName: String(settings.from_name || ""),
  };
}

/**
 * Prefer an explicit override (e.g. template), else workspace default image.
 * @param {Record<string, unknown> | null | undefined} settings
 * @param {string | null | undefined} [override]
 */
export function resolveSignatureImageUrl(settings, override) {
  const fromOverride = String(override || "").trim();
  if (fromOverride) return fromOverride;
  const fromSettings = String(settings?.signature_image_url || "").trim();
  return fromSettings || null;
}
