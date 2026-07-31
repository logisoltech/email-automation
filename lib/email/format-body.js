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
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  return sentences ? sentences.map((s) => s.trim()).filter(Boolean) : [text.trim()];
}

/**
 * Break a wall-of-text email into readable paragraphs.
 * @param {string} text
 */
export function formatBodyText(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const withoutSignature = stripSignatureBlock(trimmed);

  if (withoutSignature.includes("\n\n")) {
    return withoutSignature
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  if (withoutSignature.includes("\n")) {
    return withoutSignature
      .split(/\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  const sentences = splitIntoSentences(withoutSignature);
  if (sentences.length <= 2) {
    return withoutSignature;
  }

  const sentencesPerParagraph = withoutSignature.length > 500 ? 2 : 3;
  const paragraphs = [];

  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(" ").trim());
  }

  return paragraphs.join("\n\n");
}

/**
 * @param {string} bodyText
 */
export function textToHtmlParagraphs(bodyText) {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return "<p></p>";
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px 0; line-height: 1.6;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
}

/**
 * @param {string} text
 */
export function stripSignatureBlock(text) {
  const signatureStart = text.search(/best regards?,/i);
  if (signatureStart === -1) {
    return text.trim();
  }

  return text.slice(0, signatureStart).trim();
}

/**
 * Format plain text + build proper HTML paragraphs.
 * @param {string} bodyText
 * @param {string} [bodyHtml]
 */
export function formatEmailBody(bodyText, bodyHtml) {
  const formattedText = formatBodyText(bodyText);

  const htmlFromAi = bodyHtml?.trim() || "";
  const hasParagraphTags = /<p[\s>]/i.test(htmlFromAi);

  const bodyHtmlFormatted = hasParagraphTags
    ? ensureParagraphSpacing(htmlFromAi)
    : textToHtmlParagraphs(formattedText);

  return {
    bodyText: formattedText,
    bodyHtml: bodyHtmlFormatted,
  };
}

/**
 * @param {string} html
 */
function ensureParagraphSpacing(html) {
  return html.replace(/<p(\s[^>]*)?>/gi, (full, attrs = "") => {
    const attr = attrs || "";
    if (/style\s*=/i.test(attr)) {
      if (/margin\s*:/i.test(attr)) return full;
      return full.replace(
        /style\s*=\s*(["'])/i,
        (_m, quote) => `style=${quote}margin: 0 0 16px 0; line-height: 1.6; `
      );
    }
    return `<p style="margin: 0 0 16px 0; line-height: 1.6;">`;
  });
}

/**
 * @param {string} bodyText
 */
export function bodyTextIncludesSignature(bodyText) {
  const lower = bodyText.toLowerCase();
  return (
    /best regards?,/.test(lower) &&
    (lower.includes("ryan davis") ||
      lower.includes("logisol technologies") ||
      lower.includes("business development"))
  );
}

/**
 * Split main body from signature for HTML assembly.
 * @param {string} fullText
 */
export function splitBodyAndSignature(fullText) {
  if (!bodyTextIncludesSignature(fullText)) {
    return { main: fullText, hasSignature: false };
  }

  const signatureStart = fullText.search(/best regards?,/i);
  if (signatureStart === -1) {
    return { main: fullText, hasSignature: false };
  }

  return {
    main: fullText.slice(0, signatureStart).trim(),
    hasSignature: true,
  };
}
