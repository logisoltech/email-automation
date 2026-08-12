import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  SendEmailCommand,
  AlreadyExistsException,
  NotFoundException,
} from "@aws-sdk/client-sesv2";

/** @type {SESv2Client | null} */
let client = null;

function getRegion() {
  return (
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-east-1"
  );
}

/**
 * @returns {boolean}
 */
export function isSesConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

function getClient() {
  if (!isSesConfigured()) {
    throw new Error(
      "Platform sending is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION."
    );
  }

  if (!client) {
    client = new SESv2Client({
      region: getRegion(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
      },
    });
  }

  return client;
}

/**
 * @param {string} email
 */
export function domainFromEmail(email) {
  const at = String(email || "").trim().toLowerCase().split("@")[1] || "";
  return at.replace(/\.$/, "");
}

/**
 * @param {string} domain
 */
export function isValidDomainName(domain) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
    String(domain || "").trim()
  );
}

/**
 * @param {import("@aws-sdk/client-sesv2").GetEmailIdentityCommandOutput} identity
 */
export function buildDnsRecordsFromIdentity(identity, domain) {
  /** @type {Array<{ record: string; type: string; name: string; value: string; ttl: string; priority: number | null; status: string }>} */
  const records = [];
  const tokens = identity.DkimAttributes?.Tokens || [];
  const dkimStatus = identity.DkimAttributes?.Status || "PENDING";

  for (const token of tokens) {
    records.push({
      record: "DKIM",
      type: "CNAME",
      name: `${token}._domainkey`,
      value: `${token}.dkim.amazonses.com`,
      ttl: "Auto",
      priority: null,
      status: String(dkimStatus).toLowerCase(),
    });
  }

  // Recommended SPF include for domains that send via SES
  records.push({
    record: "SPF",
    type: "TXT",
    name: "@",
    value: "v=spf1 include:amazonses.com ~all",
    ttl: "Auto",
    priority: null,
    status: "recommended",
  });

  return records;
}

/**
 * @param {import("@aws-sdk/client-sesv2").GetEmailIdentityCommandOutput} identity
 */
export function mapSesStatus(identity) {
  if (identity.VerifiedForSendingStatus) return "verified";
  const v = String(identity.VerificationStatus || "PENDING").toUpperCase();
  if (v === "SUCCESS") return "verified";
  if (v === "FAILED") return "failed";
  if (v === "TEMPORARY_FAILURE") return "temporary_failure";
  return "pending";
}

/**
 * Create domain identity in SES (Easy DKIM) or fetch if it already exists.
 * @param {string} domain
 */
export async function ensureSesDomain(domain) {
  const name = domain.toLowerCase().trim();
  const ses = getClient();

  try {
    await ses.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: name,
      })
    );
  } catch (err) {
    const nameOrCode =
      err && typeof err === "object" && "name" in err
        ? String(/** @type {{ name?: string }} */ (err).name || "")
        : "";
    if (!(err instanceof AlreadyExistsException) && nameOrCode !== "AlreadyExistsException") {
      throw err;
    }
  }

  return getSesDomain(name);
}

/**
 * @param {string} domain
 */
export async function getSesDomain(domain) {
  const name = domain.toLowerCase().trim();
  const ses = getClient();
  const identity = await ses.send(
    new GetEmailIdentityCommand({
      EmailIdentity: name,
    })
  );

  return {
    id: name,
    name,
    status: mapSesStatus(identity),
    verified: Boolean(identity.VerifiedForSendingStatus) || mapSesStatus(identity) === "verified",
    records: buildDnsRecordsFromIdentity(identity, name),
    raw: identity,
  };
}

/**
 * Re-check DNS / verification status (SES polls DNS automatically).
 * @param {string} domain
 */
export async function refreshSesDomain(domain) {
  return getSesDomain(domain);
}

/**
 * @param {{
 *   from: string;
 *   to: string[];
 *   subject: string;
 *   text: string;
 *   html: string;
 * }} params
 */
export async function sendViaSes({ from, to, subject, text, html }) {
  const ses = getClient();
  const configSet = process.env.SES_CONFIGURATION_SET?.trim();

  return ses.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: {
        ToAddresses: to,
      },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      },
      ...(configSet ? { ConfigurationSetName: configSet } : {}),
    })
  );
}

/**
 * Format AWS / SES errors for API responses.
 * @param {unknown} error
 */
export function formatSesError(error) {
  if (!(error instanceof Error)) return "Amazon SES request failed.";
  const name = "name" in error ? String(/** @type {{ name?: string }} */ (error).name || "") : "";
  if (name === "MessageRejected" || /MessageRejected/i.test(error.message)) {
    return (
      "SES rejected the message. If your account is still in the SES sandbox, " +
      "verify the recipient address or request production access in AWS."
    );
  }
  if (name === "NotFoundException" || error instanceof NotFoundException) {
    return "Domain identity not found in Amazon SES. Register it again.";
  }
  return error.message || "Amazon SES request failed.";
}

// Keep Delete available for future cleanup UIs
export { DeleteEmailIdentityCommand };
