import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";

const HUBSPOT_AUTH = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API = "https://api.hubapi.com";

export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  // Needed to create the custom outreach status property on contacts
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
].join(" ");

export const OUTREACH_STATUS_PROPERTY = "bulkly_outreach_status";

/**
 * @returns {{ clientId: string; clientSecret: string; redirectUri: string }}
 */
export function getHubspotAppConfig() {
  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.HUBSPOT_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/api/integrations/hubspot/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("HubSpot is not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.");
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * @returns {boolean}
 */
export function isHubspotConfigured() {
  return Boolean(
    process.env.HUBSPOT_CLIENT_ID?.trim() && process.env.HUBSPOT_CLIENT_SECRET?.trim()
  );
}

/**
 * Signed OAuth state: workspaceId.timestamp.nonce.sig
 * @param {string} workspaceId
 */
export function createOAuthState(workspaceId) {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || "dev-hubspot-state";
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
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || "dev-hubspot-state";
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

/**
 * @param {string} workspaceId
 */
export function buildAuthorizeUrl(workspaceId) {
  const { clientId, redirectUri } = getHubspotAppConfig();
  const state = createOAuthState(workspaceId);
  const url = new URL(HUBSPOT_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", HUBSPOT_SCOPES);
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

/**
 * @param {string} code
 */
export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getHubspotAppConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(HUBSPOT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error_description || "HubSpot token exchange failed.");
  }
  return json;
}

/**
 * @param {string} refreshToken
 */
export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getHubspotAppConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(HUBSPOT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error_description || "HubSpot token refresh failed.");
  }
  return json;
}

/**
 * @param {Record<string, unknown>} tokens
 */
export function encryptTokenRow(tokens) {
  const expiresIn = Number(tokens.expires_in || 1800);
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
export async function getHubspotIntegration(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("workspace_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Ensure a valid access token (refresh if needed).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} integration
 */
export async function getValidAccessToken(supabase, integration) {
  const access = decryptSecret(integration.access_token_encrypted);
  const refresh = decryptSecret(integration.refresh_token_encrypted);
  if (!access) throw new Error("HubSpot is not connected.");

  const expiresAt = integration.token_expires_at
    ? new Date(String(integration.token_expires_at)).getTime()
    : 0;
  const stillValid = expiresAt - Date.now() > 60_000;

  if (stillValid) return access;
  if (!refresh) throw new Error("HubSpot session expired. Reconnect HubSpot.");

  const tokens = await refreshAccessToken(refresh);
  const encrypted = encryptTokenRow({
    ...tokens,
    refresh_token: tokens.refresh_token || refresh,
  });

  // Use admin so members can refresh tokens (RLS only lets owners update).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  await admin
    .from("workspace_integrations")
    .update({
      ...encrypted,
      status: "connected",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  Object.assign(integration, encrypted);

  return decryptSecret(encrypted.access_token_encrypted);
}

/**
 * @param {string} accessToken
 * @param {string} path
 * @param {{ method?: string; body?: unknown; query?: Record<string, string> }} [options]
 */
export async function hubspotFetch(accessToken, path, options = {}) {
  const url = new URL(path.startsWith("http") ? path : `${HUBSPOT_API}${path}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    throw new Error(json?.message || json?.error || `HubSpot API error (${res.status})`);
  }
  return json;
}

/**
 * Ensure custom contact property for outreach status exists.
 * @param {string} accessToken
 */
export async function ensureOutreachStatusProperty(accessToken) {
  try {
    await hubspotFetch(
      accessToken,
      `/crm/v3/properties/contacts/${OUTREACH_STATUS_PROPERTY}`
    );
    return;
  } catch {
    // create
  }

  await hubspotFetch(accessToken, "/crm/v3/properties/contacts", {
    method: "POST",
    body: {
      name: OUTREACH_STATUS_PROPERTY,
      label: "Bulkly outreach status",
      type: "string",
      fieldType: "text",
      groupName: "contactinformation",
      description: "Synced from Bulkly when outreach emails are sent or opened.",
    },
  });
}

/**
 * @param {string} accessToken
 * @param {{ after?: string; limit?: number }} [paging]
 */
export async function listContacts(accessToken, paging = {}) {
  return hubspotFetch(accessToken, "/crm/v3/objects/contacts", {
    query: {
      limit: String(paging.limit || 50),
      ...(paging.after ? { after: paging.after } : {}),
      properties: [
        "email",
        "firstname",
        "lastname",
        "phone",
        "company",
        "website",
        "city",
        "country",
        "jobtitle",
        "hs_object_id",
      ].join(","),
    },
  });
}

/**
 * @param {string} accessToken
 * @param {string} contactId
 * @param {string} status
 */
export async function updateContactOutreachStatus(accessToken, contactId, status) {
  return hubspotFetch(accessToken, `/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: {
      properties: {
        [OUTREACH_STATUS_PROPERTY]: status,
      },
    },
  });
}

/**
 * @param {Record<string, unknown>} contact
 */
export function mapHubspotContactToLead(contact) {
  const props = /** @type {Record<string, string>} */ (contact.properties || {});
  const first = String(props.firstname || "").trim();
  const last = String(props.lastname || "").trim();
  const name = [first, last].filter(Boolean).join(" ") || props.email || "HubSpot contact";
  const email = String(props.email || "").trim().toLowerCase();

  return {
    externalId: String(contact.id),
    name,
    email,
    phone: String(props.phone || "").trim() || null,
    country: String(props.country || "").trim() || null,
    websiteUrl: String(props.website || "").trim() || null,
    notes: [props.company && `Company: ${props.company}`, props.jobtitle && `Title: ${props.jobtitle}`]
      .filter(Boolean)
      .join("\n") || null,
    category: String(props.jobtitle || props.company || "").trim() || null,
  };
}

/**
 * Human labels for CRM property.
 */
export const OUTREACH_STATUS_LABELS = {
  sent: "Follow-up sent",
  opened: "Email opened",
  failed: "Send failed",
  skipped: "Skipped",
};
