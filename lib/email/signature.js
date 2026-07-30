import {
  formatEmailBody,
  splitBodyAndSignature,
  bodyTextIncludesSignature,
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
  const resolved = resolveSignature(signature);
  const fullText = appendEmailSignature(bodyText, signature);
  const { main } = splitBodyAndSignature(fullText);
  const { bodyHtml: mainHtml } = formatEmailBody(main, bodyHtml);

  return `${mainHtml}\n${resolved.html}`;
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
