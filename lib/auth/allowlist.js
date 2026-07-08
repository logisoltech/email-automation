/**
 * @param {string | undefined | null} email
 * @returns {boolean}
 */
export function isEmailAllowed(email) {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const explicit = process.env.ALLOWED_EMAILS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (explicit?.length) {
    return explicit.includes(normalized);
  }

  const domains = process.env.ALLOWED_EMAIL_DOMAINS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!domains?.length) {
    return false;
  }

  return domains.some(
    (domain) => normalized.endsWith(`@${domain}`) || normalized === domain
  );
}
