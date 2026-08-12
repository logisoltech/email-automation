import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { createOAuthState, parseOAuthState } from "@/lib/integrations/oauth-state";

export { createOAuthState, parseOAuthState };

/** Contact scopes + field settings so we can create Bulkly_Outreach_Status */
export const ZOHO_SCOPES = [
  "ZohoCRM.modules.contacts.READ",
  "ZohoCRM.modules.contacts.WRITE",
  "ZohoCRM.settings.fields.READ",
  "ZohoCRM.settings.fields.CREATE",
  "ZohoCRM.org.READ",
].join(",");

export const OUTREACH_STATUS_FIELD = "Bulkly_Outreach_Status";

export const OUTREACH_STATUS_LABELS = {
  sent: "Follow-up sent",
  opened: "Email opened",
  failed: "Send failed",
  skipped: "Skipped",
};

/**
 * Default accounts host (US). Override with ZOHO_ACCOUNTS_URL for EU/IN/etc.
 * @returns {string}
 */
export function getZohoAccountsBase() {
  return (
    process.env.ZOHO_ACCOUNTS_URL?.replace(/\/$/, "").trim() ||
    "https://accounts.zoho.com"
  );
}

/**
 * @returns {{ clientId: string; clientSecret: string; redirectUri: string; accountsUrl: string }}
 */
export function getZohoAppConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.ZOHO_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/api/integrations/zoho/callback`;
  const accountsUrl = getZohoAccountsBase();

  if (!clientId || !clientSecret) {
    throw new Error("Zoho is not configured. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.");
  }

  return { clientId, clientSecret, redirectUri, accountsUrl };
}

/**
 * @returns {boolean}
 */
export function isZohoConfigured() {
  return Boolean(process.env.ZOHO_CLIENT_ID?.trim() && process.env.ZOHO_CLIENT_SECRET?.trim());
}

/**
 * @param {string} workspaceId
 */
export function buildAuthorizeUrl(workspaceId) {
  const { clientId, redirectUri, accountsUrl } = getZohoAppConfig();
  const state = createOAuthState(workspaceId);
  const url = new URL(`${accountsUrl}/oauth/v2/auth`);
  url.searchParams.set("scope", ZOHO_SCOPES);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

/**
 * Map Zoho `location` callback param → accounts + api hosts.
 * @param {string | null | undefined} location
 */
export function resolveZohoDomains(location) {
  const loc = String(location || "us").toLowerCase();
  const map = {
    us: { accountsUrl: "https://accounts.zoho.com", apiDomain: "https://www.zohoapis.com" },
    eu: { accountsUrl: "https://accounts.zoho.eu", apiDomain: "https://www.zohoapis.eu" },
    in: { accountsUrl: "https://accounts.zoho.in", apiDomain: "https://www.zohoapis.in" },
    au: { accountsUrl: "https://accounts.zoho.com.au", apiDomain: "https://www.zohoapis.com.au" },
    jp: { accountsUrl: "https://accounts.zoho.jp", apiDomain: "https://www.zohoapis.jp" },
    ca: { accountsUrl: "https://accounts.zohocloud.ca", apiDomain: "https://www.zohoapis.ca" },
    sa: { accountsUrl: "https://accounts.zoho.sa", apiDomain: "https://www.zohoapis.sa" },
  };
  return map[loc] || map.us;
}

/**
 * @param {string} code
 * @param {{ accountsUrl?: string }} [opts]
 */
export async function exchangeCodeForTokens(code, opts = {}) {
  const { clientId, clientSecret, redirectUri, accountsUrl: defaultAccounts } = getZohoAppConfig();
  const accountsUrl = (opts.accountsUrl || defaultAccounts).replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(
      json?.error_description || json?.error || json?.message || "Zoho token exchange failed."
    );
  }
  return json;
}

/**
 * @param {string} refreshToken
 * @param {{ accountsUrl?: string }} [opts]
 */
export async function refreshAccessToken(refreshToken, opts = {}) {
  const { clientId, clientSecret, accountsUrl: defaultAccounts } = getZohoAppConfig();
  const accountsUrl = (opts.accountsUrl || defaultAccounts).replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(
      json?.error_description || json?.error || json?.message || "Zoho token refresh failed."
    );
  }
  return json;
}

/**
 * @param {Record<string, unknown>} tokens
 */
export function encryptTokenRow(tokens) {
  const expiresIn = Number(tokens.expires_in || 3600);
  return {
    access_token_encrypted: encryptSecret(String(tokens.access_token || "")),
    refresh_token_encrypted: tokens.refresh_token
      ? encryptSecret(String(tokens.refresh_token))
      : null,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 */
export async function getZohoIntegration(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("workspace_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "zoho")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {Record<string, unknown> | null | undefined} integration
 */
export function getZohoConfig(integration) {
  const cfg = /** @type {Record<string, string>} */ (integration?.config || {});
  return {
    apiDomain: String(cfg.apiDomain || "https://www.zohoapis.com").replace(/\/$/, ""),
    accountsUrl: String(cfg.accountsUrl || getZohoAccountsBase()).replace(/\/$/, ""),
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
  if (!access) throw new Error("Zoho is not connected.");

  const expiresAt = integration.token_expires_at
    ? new Date(String(integration.token_expires_at)).getTime()
    : 0;
  const stillValid = expiresAt - Date.now() > 60_000;

  if (stillValid) return access;
  if (!refresh) throw new Error("Zoho session expired. Reconnect Zoho.");

  const { accountsUrl } = getZohoConfig(integration);
  const tokens = await refreshAccessToken(refresh, { accountsUrl });
  const encrypted = encryptTokenRow({
    ...tokens,
    refresh_token: tokens.refresh_token || refresh,
  });

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const nextConfig = {
    ...getZohoConfig(integration),
    ...(tokens.api_domain ? { apiDomain: String(tokens.api_domain).replace(/\/$/, "") } : {}),
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
 * @param {string} apiDomain
 * @param {string} path
 * @param {{ method?: string; body?: unknown; query?: Record<string, string | number | undefined> }} [options]
 */
export async function zohoFetch(accessToken, apiDomain, path, options = {}) {
  const base = apiDomain.replace(/\/$/, "");
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
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
      json?.message ||
      json?.data?.[0]?.message ||
      json?.error ||
      `Zoho API error (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json;
}

/**
 * @param {string} accessToken
 * @param {string} apiDomain
 */
export async function fetchOrgInfo(accessToken, apiDomain) {
  const json = await zohoFetch(accessToken, apiDomain, "/crm/v8/org");
  const org = json?.org?.[0] || json?.org || null;
  if (!org) return { hubId: null, accountName: null };
  return {
    hubId: org.zgid != null ? String(org.zgid) : org.id != null ? String(org.id) : null,
    accountName: org.company_name || org.domain_name || org.primary_email || null,
  };
}

/**
 * Ensure custom contact field for outreach status exists.
 * @param {string} accessToken
 * @param {string} apiDomain
 * @param {string} [fieldApiName]
 */
export async function ensureOutreachStatusField(
  accessToken,
  apiDomain,
  fieldApiName = OUTREACH_STATUS_FIELD
) {
  try {
    const existing = await zohoFetch(
      accessToken,
      apiDomain,
      "/crm/v8/settings/fields",
      { query: { module: "Contacts" } }
    );
    const fields = existing?.fields || [];
    if (fields.some((f) => f.api_name === fieldApiName)) return;
  } catch {
    // continue to create
  }

  await zohoFetch(accessToken, apiDomain, "/crm/v8/settings/fields", {
    method: "POST",
    query: { module: "Contacts" },
    body: {
      fields: [
        {
          field_label: "Bulkly outreach status",
          api_name: fieldApiName,
          data_type: "text",
          length: 255,
        },
      ],
    },
  });
}

/**
 * @param {string} accessToken
 * @param {string} apiDomain
 * @param {{ page?: number; perPage?: number }} [paging]
 */
export async function listContacts(accessToken, apiDomain, paging = {}) {
  return zohoFetch(accessToken, apiDomain, "/crm/v8/Contacts", {
    query: {
      fields: [
        "First_Name",
        "Last_Name",
        "Full_Name",
        "Email",
        "Phone",
        "Mobile",
        "Mailing_Country",
        "Account_Name",
        "Title",
        "Website",
      ].join(","),
      per_page: paging.perPage || 50,
      page: paging.page || 1,
    },
  });
}

/**
 * @param {string} accessToken
 * @param {string} apiDomain
 * @param {string} contactId
 * @param {string} status
 * @param {string} [fieldApiName]
 */
export async function updateContactOutreachStatus(
  accessToken,
  apiDomain,
  contactId,
  status,
  fieldApiName = OUTREACH_STATUS_FIELD
) {
  return zohoFetch(accessToken, apiDomain, "/crm/v8/Contacts", {
    method: "PUT",
    body: {
      data: [
        {
          id: contactId,
          [fieldApiName]: status,
        },
      ],
    },
  });
}

/**
 * @param {Record<string, unknown>} contact
 */
export function mapZohoContactToLead(contact) {
  const first = String(contact.First_Name || "").trim();
  const last = String(contact.Last_Name || "").trim();
  const full = String(contact.Full_Name || "").trim();
  const name =
    full || [first, last].filter(Boolean).join(" ") || String(contact.Email || "Zoho contact");
  const email = String(contact.Email || "").trim().toLowerCase();
  const account = contact.Account_Name;
  const company =
    typeof account === "object" && account
      ? String(/** @type {{ name?: string }} */ (account).name || "")
      : String(account || "");

  return {
    externalId: String(contact.id),
    name,
    email,
    phone: String(contact.Phone || contact.Mobile || "").trim() || null,
    country: String(contact.Mailing_Country || "").trim() || null,
    websiteUrl: String(contact.Website || "").trim() || null,
    notes:
      [company && `Company: ${company}`, contact.Title && `Title: ${contact.Title}`]
        .filter(Boolean)
        .join("\n") || null,
    category: String(contact.Title || company || "").trim() || null,
    company: company || null,
  };
}
