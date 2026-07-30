import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * @returns {Buffer}
 */
function getEncryptionKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is not set. Generate a 32-byte hex key for encrypting SMTP passwords."
    );
  }

  // Accept 64-char hex or base64 32-byte key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === 32) {
    return fromBase64;
  }

  // Derive a stable 32-byte key from any string (dev fallback)
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a secret for storage. Returns `iv:tag:ciphertext` hex.
 * @param {string} plaintext
 */
export function encryptSecret(plaintext) {
  if (!plaintext) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * @param {string | null | undefined} payload
 */
export function decryptSecret(payload) {
  if (!payload) return null;

  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted secret format.");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * @param {string | null | undefined} value
 */
export function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
