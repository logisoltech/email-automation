/**
 * Mail-merge helpers for {{name}}, {{company}}, etc.
 * Case-insensitive; spaces inside braces are allowed ({{ name }}).
 */

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * @param {string | null | undefined} text
 */
export function containsPlaceholders(text) {
  if (!text) return false;
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text);
}

/**
 * @param {string | null | undefined} notes
 * @returns {string}
 */
export function companyFromNotes(notes) {
  const raw = String(notes || "");
  const match = raw.match(/(?:^|\n)\s*Company:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : "";
}

/**
 * @param {string | null | undefined} websiteUrl
 * @returns {string}
 */
function companyFromWebsite(websiteUrl) {
  const raw = String(websiteUrl || "").trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./i, "");
    return host || "";
  } catch {
    return "";
  }
}

/**
 * @param {string | null | undefined} fullName
 */
export function firstNameFromFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || "";
}

/**
 * Build a flat merge map from a lead row (DB or API shape).
 * @param {Record<string, unknown> | null | undefined} lead
 * @param {{ email?: string }} [opts]
 * @returns {Record<string, string>}
 */
export function buildMergeContext(lead, opts = {}) {
  if (!lead) {
    return emptyContext(opts.email);
  }

  const name = String(lead.name || "").trim();
  const emails = Array.isArray(lead.emails)
    ? lead.emails.map((e) => String(e || "").trim()).filter(Boolean)
    : [];
  const email = String(opts.email || emails[0] || "").trim();
  const notes = lead.notes != null ? String(lead.notes) : "";
  const website =
    lead.website_url != null
      ? String(lead.website_url)
      : lead.websiteUrl != null
        ? String(lead.websiteUrl)
        : "";
  const category = String(lead.category || "").trim();
  const company =
    companyFromNotes(notes) ||
    companyFromWebsite(website) ||
    category ||
    "";

  const projectDescription =
    lead.project_description != null
      ? String(lead.project_description)
      : lead.projectDescription != null
        ? String(lead.projectDescription)
        : "";

  const firstName = firstNameFromFullName(name);

  /** @type {Record<string, string>} */
  const ctx = {
    name,
    full_name: name,
    fullname: name,
    first_name: firstName,
    firstname: firstName,
    company,
    email,
    phone: String(lead.phone || "").trim(),
    country: String(lead.country || "").trim(),
    category,
    budget: String(lead.budget || "").trim(),
    project: projectDescription,
    project_description: projectDescription,
    description: projectDescription,
    website,
    website_url: website,
  };

  return ctx;
}

/**
 * @param {string | undefined} email
 */
function emptyContext(email) {
  return {
    name: "",
    full_name: "",
    fullname: "",
    first_name: "",
    firstname: "",
    company: "",
    email: String(email || "").trim(),
    phone: "",
    country: "",
    category: "",
    budget: "",
    project: "",
    project_description: "",
    description: "",
    website: "",
    website_url: "",
  };
}

/**
 * Replace {{placeholders}} in a string. Unknown keys become empty string.
 * @param {string | null | undefined} text
 * @param {Record<string, string>} context
 */
export function mergePlaceholders(text, context) {
  if (text == null || text === "") return text ?? "";
  return String(text).replace(PLACEHOLDER_RE, (_match, key) => {
    const normalized = String(key || "").toLowerCase();
    const value = context[normalized];
    return value != null ? String(value) : "";
  });
}

/**
 * @param {{
 *   subject?: string | null;
 *   bodyText?: string | null;
 *   bodyHtml?: string | null;
 * }} fields
 * @param {Record<string, unknown> | null | undefined} lead
 * @param {{ email?: string }} [opts]
 */
export function mergeEmailFields(fields, lead, opts = {}) {
  const context = buildMergeContext(lead, opts);
  return {
    subject: mergePlaceholders(fields.subject ?? "", context),
    bodyText: mergePlaceholders(fields.bodyText ?? "", context),
    bodyHtml: mergePlaceholders(fields.bodyHtml ?? "", context),
    context,
  };
}

/**
 * True if any of the email fields still need merge.
 * @param {{ subject?: string | null; bodyText?: string | null; bodyHtml?: string | null }} fields
 */
export function emailHasPlaceholders(fields) {
  return (
    containsPlaceholders(fields.subject) ||
    containsPlaceholders(fields.bodyText) ||
    containsPlaceholders(fields.bodyHtml)
  );
}

/**
 * Load workspace leads whose emails overlap the given recipient list.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {string[]} recipients
 * @returns {Promise<Map<string, Record<string, unknown>>>} email(lower) → lead
 */
export async function mapLeadsByRecipientEmail(supabase, workspaceId, recipients) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byEmail = new Map();
  const normalized = [
    ...new Set(
      recipients.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
    ),
  ];
  if (!normalized.length) return byEmail;

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, name, emails, phone, country, category, project_description, budget, website_url, notes"
    )
    .eq("workspace_id", workspaceId)
    .overlaps("emails", normalized);

  if (error) {
    console.error("[merge] mapLeadsByRecipientEmail", error.message);
    return byEmail;
  }

  for (const lead of data ?? []) {
    for (const email of lead.emails || []) {
      const key = String(email || "")
        .trim()
        .toLowerCase();
      if (key && !byEmail.has(key)) {
        byEmail.set(key, lead);
      }
    }
  }

  return byEmail;
}
