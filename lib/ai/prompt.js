import { formatEmailBody } from "@/lib/email/format-body";

/**
 * @param {string} userPrompt
 * @param {{ tone?: string; audience?: string; instructionsBlock?: string }} [context]
 */
export function buildEmailPrompt(userPrompt, context = {}) {
  const tone = context.tone?.trim() || "professional and friendly";
  const audience = context.audience?.trim() || "business contacts";
  const instructions = context.instructionsBlock?.trim();

  return `You are an expert email copywriter. Write an email based on the user's request.

Tone: ${tone}
Audience: ${audience}
${instructions ? `\n${instructions}\n` : ""}
User request:
${userPrompt}

Respond with valid JSON only, using this exact shape (plain text only — no HTML):
{
  "subject": "email subject line",
  "bodyText": "plain text with paragraphs separated by blank lines (\\n\\n between each paragraph)"
}`;
}

/**
 * Extract a JSON string field value from partial or malformed JSON.
 * @param {string} raw
 * @param {string} field
 */
export function extractJsonStringField(raw, field) {
  const marker = `"${field}"`;
  const keyIndex = raw.indexOf(marker);
  if (keyIndex === -1) return null;

  let i = raw.indexOf(":", keyIndex + marker.length);
  if (i === -1) return null;

  while (i < raw.length && /[\s:]/.test(raw[i])) {
    i += 1;
  }

  if (raw[i] !== '"') return null;
  i += 1;

  let result = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === "n") result += "\n";
      else if (next === "r") result += "\r";
      else if (next === "t") result += "\t";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else result += next ?? "";
      i += 2;
      continue;
    }
    if (ch === '"') break;
    result += ch;
    i += 1;
  }

  return result || null;
}

/**
 * Recover subject/body from Groq json_validate_failed payloads.
 * @param {string} raw
 */
export function salvagePartialEmailJson(raw) {
  const subject = extractJsonStringField(raw, "subject");
  const bodyText = extractJsonStringField(raw, "bodyText");

  if (!subject?.trim() || !bodyText?.trim()) {
    return null;
  }

  return { subject: subject.trim(), bodyText: bodyText.trim() };
}

/**
 * @param {string} errorText
 */
export function trySalvageGroqErrorResponse(errorText) {
  try {
    const err = JSON.parse(errorText);
    const failed = err?.error?.failed_generation;
    if (typeof failed === "string") {
      return salvagePartialEmailJson(failed);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * @param {string} raw
 */
export function parseEmailJson(raw) {
  const trimmed = raw.trim();

  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found.");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.subject || !parsed.bodyText) {
      throw new Error("Missing subject or body.");
    }

    const formatted = formatEmailBody(String(parsed.bodyText), "");

    return {
      subject: String(parsed.subject).trim(),
      bodyText: formatted.bodyText,
      bodyHtml: formatted.bodyHtml,
    };
  } catch {
    const salvaged = salvagePartialEmailJson(trimmed);
    if (!salvaged) {
      throw new Error("AI did not return valid JSON.");
    }

    const formatted = formatEmailBody(salvaged.bodyText, "");

    return {
      subject: salvaged.subject,
      bodyText: formatted.bodyText,
      bodyHtml: formatted.bodyHtml,
    };
  }
}
