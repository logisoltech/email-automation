/**
 * @param {string} name
 */
export function slugifyCategoryName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "category";
}

/**
 * Ensure Website + SMM defaults exist for a workspace.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 */
export async function ensureDefaultLeadCategories(supabase, workspaceId) {
  const defaults = [
    { name: "Website", slug: "website" },
    { name: "SMM", slug: "smm" },
  ];

  for (const item of defaults) {
    const { data: existing } = await supabase
      .from("lead_categories")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("slug", item.slug)
      .maybeSingle();

    if (!existing) {
      await supabase.from("lead_categories").insert({
        workspace_id: workspaceId,
        name: item.name,
        slug: item.slug,
      });
    }
  }
}

/**
 * Map a subcategory slug/name to the AI prompt family.
 * @param {{ slug?: string; name?: string; lead_type?: string | null } | null | undefined} category
 * @returns {'website' | 'smm'}
 */
export function resolveLeadEmailType(category) {
  const haystack = `${category?.lead_type || ""} ${category?.slug || ""} ${category?.name || ""}`.toLowerCase();
  if (/\bsmm\b|social/.test(haystack)) return "smm";
  return "website";
}

export const CAMPAIGN_MAX_LEADS = 100;
