import { randomBytes, createHmac, timingSafeEqual } from "crypto";

/**
 * Signed OAuth state: workspaceId.timestamp.nonce.sig
 * @param {string} workspaceId
 */
export function createOAuthState(workspaceId) {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || "dev-oauth-state";
  const nonce = randomBytes(8).toString("hex");
  const ts = Date.now().toString(36);
  const payload = `${workspaceId}.${ts}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24);
  return `${payload}.${sig}`;
}

/**
 * @param {string} state
 * @returns {string | null} workspaceId
 */
export function parseOAuthState(state) {
  const parts = String(state || "").split(".");
  if (parts.length !== 4) return null;
  const [workspaceId, ts, nonce, sig] = parts;
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || "dev-oauth-state";
  const payload = `${workspaceId}.${ts}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const ageMs = Date.now() - parseInt(ts, 36);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60 * 1000) return null;
  return workspaceId;
}
