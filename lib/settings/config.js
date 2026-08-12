import { getActiveProvider } from "@/lib/ai";

/**
 * @param {string | undefined} value
 */
function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

/**
 * @param {Record<string, unknown> | null} [workspaceSettings]
 */
export function getSettingsStatus(workspaceSettings) {
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
    smtp: workspaceSettings
      ? {
          configured: Boolean(
            workspaceSettings.sending_mode === "platform"
              ? workspaceSettings.domain_verified_at
              : workspaceSettings.smtp_configured
          ),
          mode: workspaceSettings.sending_mode || (workspaceSettings.smtp_configured ? "own_smtp" : null),
          domain: workspaceSettings.sending_domain || null,
          domainVerified: Boolean(workspaceSettings.domain_verified_at),
          host: workspaceSettings.smtp_host || null,
          port: String(workspaceSettings.smtp_port || 587),
          secure: String(Boolean(workspaceSettings.smtp_secure)),
          user: workspaceSettings.smtp_user || null,
          fromEmail: workspaceSettings.from_email || workspaceSettings.smtp_user || null,
          fromName: workspaceSettings.from_name || "",
        }
      : {
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
