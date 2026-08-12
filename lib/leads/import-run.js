/**
 * Create a lead import run for campaign "latest import" picking.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{
 *   workspaceId: string;
 *   userId: string | null | undefined;
 *   source: "paste" | "hubspot" | "zoho";
 *   categoryId?: string | null;
 *   leadCount?: number;
 * }} options
 * @returns {Promise<string>} import run id
 */
export async function createImportRun(supabase, options) {
  const { workspaceId, userId, source, categoryId = null, leadCount = 0 } = options;

  const { data, error } = await supabase
    .from("lead_import_runs")
    .insert({
      workspace_id: workspaceId,
      source,
      category_id: categoryId || null,
      lead_count: leadCount,
      created_by: userId || null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create import run.");
  }

  return data.id;
}

/**
 * Update lead_count after inserts finish.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} runId
 * @param {number} leadCount
 */
export async function finalizeImportRun(supabase, runId, leadCount) {
  if (!runId) return;
  await supabase
    .from("lead_import_runs")
    .update({ lead_count: leadCount })
    .eq("id", runId);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 */
export async function getLatestImportRun(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("lead_import_runs")
    .select("id, source, category_id, lead_count, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
