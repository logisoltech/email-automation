import { getActiveProvider } from "@/lib/ai";

/**
 * @param {string | undefined} value
 */
function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function getSettingsStatus() {
  const provider = getActiveProvider();

  return {
    ai: {
      provider,
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
        keyPreview: maskSecret(process.env.GEMINI_API_KEY),
      },
      groq: {
        configured: Boolean(process.env.GROQ_API_KEY),
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        keyPreview: maskSecret(process.env.GROQ_API_KEY),
      },
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        keyPreview: maskSecret(process.env.OPENAI_API_KEY),
      },
    },
    smtp: {
      configured: Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
      ),
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || "587",
      secure: process.env.SMTP_SECURE || "false",
      user: process.env.SMTP_USER || null,
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null,
      fromName: process.env.SMTP_FROM_NAME || "Logisol",
    },
    access: {
      allowedDomains:
        process.env.ALLOWED_EMAIL_DOMAINS?.split(",").map((d) => d.trim()).filter(Boolean) ||
        [],
    },
    scheduling: {
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    },
  };
}
