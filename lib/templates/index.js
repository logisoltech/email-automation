import { starterTemplateRows } from "@/lib/templates/starters";

const TEMPLATE_SELECT =
  "id, name, subject, body_text, body_html, logo_url, signature_image_url, is_starter, created_at, updated_at";

/**
 * Map a DB row to the API shape.
 * @param {Record<string, unknown>} row
 */
export function publicTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body_text: row.body_text,
    body_html: row.body_html,
    logo_url: row.logo_url || null,
    signature_image_url: row.signature_image_url || null,
    is_starter: Boolean(row.is_starter),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * If the workspace has no templates yet, seed the four starters.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {string | null} [userId]
 * @returns {Promise<{ templates: ReturnType<typeof publicTemplate>[]; seeded: boolean }>}
 */
export async function listTemplatesEnsuringStarters(supabase, workspaceId, userId = null) {
  const { data, error } = await supabase
    .from("email_templates")
    .select(TEMPLATE_SELECT)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  if ((data?.length ?? 0) > 0) {
    return { templates: (data || []).map(publicTemplate), seeded: false };
  }

  const rows = starterTemplateRows(workspaceId, userId);
  const { data: inserted, error: insertError } = await supabase
    .from("email_templates")
    .insert(rows)
    .select(TEMPLATE_SELECT);

  if (insertError) throw new Error(insertError.message);

  return {
    templates: (inserted || []).map(publicTemplate),
    seeded: true,
  };
}

/**
 * Seed starters for a brand-new workspace (ignore if any already exist).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {string | null} [userId]
 */
export async function seedStarterTemplates(supabase, workspaceId, userId = null) {
  const { count, error: countError } = await supabase
    .from("email_templates")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) return { seeded: false };

  const { error } = await supabase
    .from("email_templates")
    .insert(starterTemplateRows(workspaceId, userId));

  if (error) throw new Error(error.message);
  return { seeded: true };
}

export { TEMPLATE_SELECT };
