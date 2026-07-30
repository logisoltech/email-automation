import nodemailer from "nodemailer";
import { decryptSecret } from "@/lib/crypto/secrets";

/** @type {Map<string, import("nodemailer").Transporter>} */
const transporterCache = new Map();

/**
 * @param {Record<string, unknown>} parts
 */
function transporterCacheKey(parts) {
  return Object.entries(parts)
    .map(([key, value]) => `${key}:${value ?? ""}`)
    .join("|");
}

/**
 * @param {string} key
 * @param {() => import("nodemailer").Transporter} factory
 */
function getCachedTransporter(key, factory) {
  const existing = transporterCache.get(key);
  if (existing) return existing;

  const transporter = factory();
  transporterCache.set(key, transporter);
  return transporter;
}

/**
 * @param {{
 *   smtp_host?: string | null;
 *   smtp_port?: number | null;
 *   smtp_secure?: boolean | null;
 *   smtp_user?: string | null;
 *   smtp_pass_encrypted?: string | null;
 *   smtp_tls_reject_unauthorized?: boolean | null;
 *   from_name?: string | null;
 *   from_email?: string | null;
 * }} settings
 */
export function getMailTransporterFromSettings(settings) {
  const host = settings?.smtp_host;
  const user = settings?.smtp_user;
  const pass = decryptSecret(settings?.smtp_pass_encrypted);
  const port = Number(settings?.smtp_port || 587);

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured for this workspace. Add your mail server details in Settings."
    );
  }

  const secure = Boolean(settings?.smtp_secure) || port === 465;
  const rejectUnauthorized = settings?.smtp_tls_reject_unauthorized !== false;
  const key = transporterCacheKey({
    host,
    port,
    user,
    pass,
    secure,
    rejectUnauthorized,
  });

  return getCachedTransporter(key, () =>
    nodemailer.createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 2,
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        minVersion: "TLSv1.2",
        servername: host,
        rejectUnauthorized,
      },
    })
  );
}

/**
 * Fallback for legacy env-based SMTP (local Logisol / migration period).
 */
export function getEnvMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Add SMTP_* variables or workspace settings.");
  }

  const secure =
    process.env.SMTP_SECURE === "true"
      ? true
      : process.env.SMTP_SECURE === "false"
        ? false
        : port === 465;

  const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";
  const key = transporterCacheKey({
    source: "env",
    host,
    port,
    user,
    pass,
    secure,
    rejectUnauthorized,
  });

  return getCachedTransporter(key, () =>
    nodemailer.createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 2,
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        minVersion: "TLSv1.2",
        servername: host,
        rejectUnauthorized,
      },
    })
  );
}

/**
 * @deprecated Prefer getMailTransporterFromSettings
 */
export function getMailTransporter() {
  return getEnvMailTransporter();
}

/**
 * @param {{ from_name?: string | null; from_email?: string | null; smtp_user?: string | null }} [settings]
 */
export function getFromAddress(settings) {
  if (settings) {
    const name = settings.from_name || "Mail";
    const email = settings.from_email || settings.smtp_user;
    if (!email) throw new Error("From email is not configured for this workspace.");
    return `"${name}" <${email}>`;
  }

  const name = process.env.SMTP_FROM_NAME || "Logisol";
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  if (!email) throw new Error("SMTP_FROM_EMAIL or SMTP_USER must be set.");
  return `"${name}" <${email}>`;
}

/**
 * True when the SMTP provider is temporarily overloaded / unreachable.
 * @param {unknown} error
 */
export function isTransientSmtpError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String(/** @type {{ code?: unknown }} */ (error).code ?? "")
      : "";
  const responseCode =
    error && typeof error === "object" && "responseCode" in error
      ? Number(/** @type {{ responseCode?: unknown }} */ (error).responseCode)
      : NaN;

  if ([421, 450, 451, 452].includes(responseCode)) return true;

  return (
    /(?:^|\D)(421|450|451|452)(?:\D|$)/.test(message) ||
    /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ESOCKET|EPIPE|ENOTFOUND/i.test(message) ||
    /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ESOCKET|EPIPE|ENOTFOUND/i.test(code) ||
    /try again|temporarily|rate.?limit|too many|connection (?:limit|refused)|timeout/i.test(
      message
    )
  );
}

/**
 * @param {unknown} error
 */
export function formatSmtpError(error) {
  if (!(error instanceof Error)) {
    return "Failed to send email.";
  }

  const message = error.message;

  if (
    /domain .* not allowed in header.*from/i.test(message) ||
    /sender address rejected/i.test(message) ||
    /from address.*not allowed/i.test(message)
  ) {
    return (
      "The From email is not allowed by this SMTP server. Set the From email to the SMTP mailbox address (for example, ryan@yourdomain.com), or use a sender address explicitly authorized by your mail provider."
    );
  }

  if (message.includes("altnames") || message.includes("certificate")) {
    return (
      "Mail server certificate does not match the hostname (common on shared hosting). Disable TLS certificate verification in advanced SMTP settings, or fix the certificate on your mail host."
    );
  }

  if (message.includes("ETIMEDOUT") || message.includes("ECONNREFUSED")) {
    return (
      "Could not reach the mail server. Check SMTP host/port (often mail.yourdomain.com:587)."
    );
  }

  if (message.includes("EAUTH") || message.includes("Authentication") || message.includes("535")) {
    return (
      "SMTP login failed. Use the full mailbox address and that mailbox password (not your hosting panel password)."
    );
  }

  return message;
}
