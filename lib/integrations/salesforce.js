import { createHash, randomBytes } from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { createOAuthState, parseOAuthState } from "@/lib/integrations/oauth-state";

export { createOAuthState, parseOAuthState };

/** Connected App OAuth scopes */
export const SALESFORCE_SCOPES = ["api", "refresh_token", "offline_access"].join(" ");

/** HttpOnly cookie holding PKCE verifier between connect → callback */
export const SF_PKCE_COOKIE = "sf_oauth_pkce";

/**
 * Generate PKCE verifier + S256 challenge (required by External Client Apps).
 * @returns {{ verifier: string; challenge: string }}
 */
export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export const API_VERSION = "v59.0";

/** Custom Contact field API name (must end with __c in Salesforce) */
export const OUTREACH_STATUS_FIELD = "Bulkly_Outreach_Status__c";

export const OUTREACH_STATUS_LABELS = {
  sent: "Follow-up sent",
  opened: "Email opened",
  failed: "Send failed",
  skipped: "Skipped",
};

/**
 * @returns {string}
 */
export function getSalesforceLoginBase() {
  return (
    process.env.SALESFORCE_LOGIN_URL?.replace(/\/$/, "").trim() ||
    "https://login.salesforce.com"
  );
}

/**
 * @returns {{ clientId: string; clientSecret: string; redirectUri: string; loginUrl: string }}
 */
export function getSalesforceAppConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.SALESFORCE_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/api/integrations/salesforce/callback`;
  const loginUrl = getSalesforceLoginBase();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Salesforce is not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret, redirectUri, loginUrl };
}

/**
 * @returns {boolean}
 */
export function isSalesforceConfigured() {
  return Boolean(
    process.env.SALESFORCE_CLIENT_ID?.trim() && process.env.SALESFORCE_CLIENT_SECRET?.trim()
  );
}

/**
 * @param {string} workspaceId
 * @param {{ codeChallenge?: string }} [opts]
 */
export function buildAuthorizeUrl(workspaceId, opts = {}) {
  const { clientId, redirectUri, loginUrl } = getSalesforceAppConfig();
  const state = createOAuthState(workspaceId);
  const url = new URL(`${loginUrl}/services/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SALESFORCE_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "login consent");
  if (opts.codeChallenge) {
    url.searchParams.set("code_challenge", opts.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return { url: url.toString(), state };
}

/**
 * @param {string} code
 * @param {{ codeVerifier?: string }} [opts]
 */
export async function exchangeCodeForTokens(code, opts = {}) {
  const { clientId, clientSecret, redirectUri, loginUrl } = getSalesforceAppConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  if (opts.codeVerifier) {
    body.set("code_verifier", opts.codeVerifier);
  }

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(
      json?.error_description || json?.error || json?.message || "Salesforce token exchange failed."
    );
  }
  return json;
}

/**
 * @param {string} refreshToken
 * @param {{ loginUrl?: string }} [opts]
 */
export async function refreshAccessToken(refreshToken, opts = {}) {
  const { clientId, clientSecret, loginUrl: defaultLogin } = getSalesforceAppConfig();
  const loginUrl = (opts.loginUrl || defaultLogin).replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(
      json?.error_description || json?.error || json?.message || "Salesforce token refresh failed."
    );
  }
  return json;
}

/**
 * Salesforce access tokens last ~2h; issued_at is ms epoch string.
 * @param {Record<string, unknown>} tokens
 */
export function encryptTokenRow(tokens) {
  const issuedAt = Number(tokens.issued_at) || Date.now();
  // Default ~2 hours if no expires_in
  const expiresInMs = tokens.expires_in
    ? Number(tokens.expires_in) * 1000
    : 2 * 60 * 60 * 1000;
  return {
    access_token_encrypted: encryptSecret(String(tokens.access_token || "")),
    refresh_token_encrypted: tokens.refresh_token
      ? encryptSecret(String(tokens.refresh_token))
      : null,
    token_expires_at: new Date(issuedAt + expiresInMs).toISOString(),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 */
export async function getSalesforceIntegration(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("workspace_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {Record<string, unknown> | null | undefined} integration
 */
export function getSalesforceConfig(integration) {
  const cfg = /** @type {Record<string, string>} */ (integration?.config || {});
  return {
    instanceUrl: String(cfg.instanceUrl || "").replace(/\/$/, ""),
    loginUrl: String(cfg.loginUrl || getSalesforceLoginBase()).replace(/\/$/, ""),
    statusField: String(cfg.statusField || OUTREACH_STATUS_FIELD),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} integration
 */
export async function getValidAccessToken(supabase, integration) {
  const access = decryptSecret(integration.access_token_encrypted);
  const refresh = decryptSecret(integration.refresh_token_encrypted);
  if (!access) throw new Error("Salesforce is not connected.");

  const expiresAt = integration.token_expires_at
    ? new Date(String(integration.token_expires_at)).getTime()
    : 0;
  const stillValid = expiresAt - Date.now() > 60_000;

  if (stillValid) return access;
  if (!refresh) throw new Error("Salesforce session expired. Reconnect Salesforce.");

  const { loginUrl } = getSalesforceConfig(integration);
  const tokens = await refreshAccessToken(refresh, { loginUrl });
  const encrypted = encryptTokenRow({
    ...tokens,
    refresh_token: tokens.refresh_token || refresh,
  });

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const nextConfig = {
    ...getSalesforceConfig(integration),
    ...(tokens.instance_url
      ? { instanceUrl: String(tokens.instance_url).replace(/\/$/, "") }
      : {}),
  };

  await admin
    .from("workspace_integrations")
    .update({
      ...encrypted,
      status: "connected",
      last_error: null,
      config: nextConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  Object.assign(integration, encrypted, { config: nextConfig });
  return decryptSecret(encrypted.access_token_encrypted);
}

/**
 * @param {string} accessToken
 * @param {string} instanceUrl
 * @param {string} path
 * @param {{ method?: string; body?: unknown; query?: Record<string, string | undefined> }} [options]
 */
export async function salesforceFetch(accessToken, instanceUrl, path, options = {}) {
  const base = instanceUrl.replace(/\/$/, "");
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const msg =
      (Array.isArray(json) && json[0]?.message) ||
      json?.message ||
      json?.error_description ||
      json?.error ||
      `Salesforce API error (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json;
}

/**
 * @param {string} accessToken
 * @param {string} instanceUrl
 * @param {string} identityUrl from token `id`
 */
export async function fetchOrgInfo(accessToken, instanceUrl, identityUrl) {
  if (identityUrl) {
    try {
      const info = await salesforceFetch(accessToken, instanceUrl, identityUrl);
      return {
        hubId: info.organization_id ? String(info.organization_id) : null,
        accountName:
          info.display_name ||
          info.username ||
          info.organization_id ||
          null,
      };
    } catch {
      // fall through
    }
  }
  return { hubId: null, accountName: null };
}

/**
 * Best-effort: ensure custom Contact field exists via Tooling API.
 * Orgs without Customize Application permission will skip quietly.
 * @param {string} accessToken
 * @param {string} instanceUrl
 * @param {string} [fieldApiName]
 */
export async function ensureOutreachStatusField(
  accessToken,
  instanceUrl,
  fieldApiName = OUTREACH_STATUS_FIELD
) {
  try {
    const describe = await salesforceFetch(
      accessToken,
      instanceUrl,
      `/services/data/${API_VERSION}/sobjects/Contact/describe`
    );
    const fields = describe?.fields || [];
    if (fields.some((f) => f.name === fieldApiName)) return;
  } catch {
    // continue to create attempt
  }

  // Tooling API CustomField create (may fail without admin rights)
  const label = "Bulkly outreach status";
  const fullName = `Contact.${fieldApiName}`;
  await salesforceFetch(
    accessToken,
    instanceUrl,
    `/services/data/${API_VERSION}/tooling/sobjects/CustomField`,
    {
      method: "POST",
      body: {
        FullName: fullName,
        Metadata: {
          type: "Text",
          label,
          length: 255,
          description: "Synced from Bulkly when outreach emails are sent or opened.",
        },
      },
    }
  );
}

/**
 * @param {string} accessToken
 * @param {string} instanceUrl
 * @param {{ nextUrl?: string; limit?: number }} [paging]
 */
export async function listContacts(accessToken, instanceUrl, paging = {}) {
  if (paging.nextUrl) {
    return salesforceFetch(accessToken, instanceUrl, paging.nextUrl);
  }

  const limit = Math.min(200, Math.max(1, paging.limit || 50));
  const soql = [
    "SELECT Id, FirstName, LastName, Email, Phone, MobilePhone,",
    "MailingCountry, Title, Account.Name",
    "FROM Contact",
    "WHERE Email != null",
    "ORDER BY LastModifiedDate DESC",
    `LIMIT ${limit}`,
  ].join(" ");

  return salesforceFetch(
    accessToken,
    instanceUrl,
    `/services/data/${API_VERSION}/query`,
    { query: { q: soql } }
  );
}

/**
 * @param {string} accessToken
 * @param {string} instanceUrl
 * @param {string} contactId
 * @param {string} status
 * @param {string} [fieldApiName]
 */
export async function updateContactOutreachStatus(
  accessToken,
  instanceUrl,
  contactId,
  status,
  fieldApiName = OUTREACH_STATUS_FIELD
) {
  return salesforceFetch(
    accessToken,
    instanceUrl,
    `/services/data/${API_VERSION}/sobjects/Contact/${contactId}`,
    {
      method: "PATCH",
      body: {
        [fieldApiName]: status,
      },
    }
  );
}

/**
 * @param {Record<string, unknown>} contact
 */
export function mapSalesforceContactToLead(contact) {
  const first = String(contact.FirstName || "").trim();
  const last = String(contact.LastName || "").trim();
  const name =
    [first, last].filter(Boolean).join(" ") ||
    String(contact.Email || "Salesforce contact");
  const email = String(contact.Email || "").trim().toLowerCase();
  const account = contact.Account;
  const company =
    typeof account === "object" && account
      ? String(/** @type {{ Name?: string }} */ (account).Name || "")
      : "";

  return {
    externalId: String(contact.Id),
    name,
    email,
    phone: String(contact.Phone || contact.MobilePhone || "").trim() || null,
    country: String(contact.MailingCountry || "").trim() || null,
    websiteUrl: null,
    notes:
      [company && `Company: ${company}`, contact.Title && `Title: ${contact.Title}`]
        .filter(Boolean)
        .join("\n") || null,
    category: String(contact.Title || company || "").trim() || null,
    company: company || null,
  };
}
