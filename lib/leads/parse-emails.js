/**
 * @param {string} value
 * @returns {string[]}
 */
export function parseEmailField(value) {
  if (!value?.trim()) return [];

  return value
    .split(/[/;,]+/)
    .map((email) => email.trim().toLowerCase().replace(/[^\w@.+.-]/g, ""))
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
