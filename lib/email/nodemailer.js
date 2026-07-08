import nodemailer from "nodemailer";

/**
 * @returns {import("nodemailer").Transporter}
 */
export function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Add SMTP_* variables to .env.local.");
  }

  const secure =
    process.env.SMTP_SECURE === "true"
      ? true
      : process.env.SMTP_SECURE === "false"
        ? false
        : port === 465;

  const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";

  return nodemailer.createTransport({
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
  });
}

export function getFromAddress() {
  const name = process.env.SMTP_FROM_NAME || "Logisol";
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  if (!email) {
    throw new Error("SMTP_FROM_EMAIL or SMTP_USER must be set.");
  }

  return `"${name}" <${email}>`;
}

/**
 * Optional BCC to sender inbox. Off by default — use History in the app instead.
 * Enable with SMTP_BCC_SELF=true in .env.local.
 */
export function getSentCopyAddress() {
  if (process.env.SMTP_BCC_SELF !== "true") {
    return null;
  }

  const email = (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim();
  return email || null;
}

/**
 * @param {unknown} error
 */
export function formatSmtpError(error) {
  if (!(error instanceof Error)) {
    return "Failed to send email.";
  }

  const message = error.message;

  if (message.includes("altnames") || message.includes("certificate")) {
    return (
      "Mail server certificate does not match the hostname (common on shared hosting). Add SMTP_TLS_REJECT_UNAUTHORIZED=false to .env.local and restart the dev server."
    );
  }

  if (message.includes("ETIMEDOUT") || message.includes("ECONNREFUSED")) {
    return (
      "Could not reach the mail server. Try SMTP_HOST=mail.logisol.tech, SMTP_PORT=587, SMTP_SECURE=false in .env.local, then restart the dev server."
    );
  }

  if (message.includes("EAUTH") || message.includes("Authentication") || message.includes("535")) {
    return (
      "SMTP login failed (535). Use your email account password (not cPanel login). SMTP_USER should be the full address e.g. ryan.d@logisol.tech. If the password has # or $ characters, wrap SMTP_PASS in double quotes in .env.local."
    );
  }

  return message;
}
