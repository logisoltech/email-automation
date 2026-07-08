import {
  formatEmailBody,
  splitBodyAndSignature,
  bodyTextIncludesSignature,
} from "@/lib/email/format-body";

export const EMAIL_SIGNATURE_TEXT = `Best Regards,
Ryan Davis
Business Development Manager
(415) 969-4133
Logisol Technologies`;

export const EMAIL_SIGNATURE_HTML = `<p style="margin: 16px 0 0 0; line-height: 1.6;">Best Regards,<br>
Ryan Davis<br>
Business Development Manager<br>
(415) 969-4133<br>
Logisol Technologies</p>`;

/**
 * @param {string} bodyText
 */
export function appendEmailSignature(bodyText) {
  const formatted = formatEmailBody(bodyText, "").bodyText;

  if (bodyTextIncludesSignature(formatted)) {
    return formatted;
  }

  return `${formatted}\n\n${EMAIL_SIGNATURE_TEXT}`;
}

/**
 * @param {string} bodyText
 * @param {string} [bodyHtml]
 */
export function buildEmailHtml(bodyText, bodyHtml) {
  const fullText = appendEmailSignature(bodyText);
  const { main } = splitBodyAndSignature(fullText);
  const { bodyHtml: mainHtml } = formatEmailBody(main, bodyHtml);

  return `${mainHtml}\n${EMAIL_SIGNATURE_HTML}`;
}

/**
 * @param {{ bodyText: string; bodyHtml?: string }} email
 */
export function withEmailSignature(email) {
  const bodyText = appendEmailSignature(email.bodyText);
  const bodyHtml = buildEmailHtml(email.bodyText, email.bodyHtml);

  return { bodyText, bodyHtml };
}
