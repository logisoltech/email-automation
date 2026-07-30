import { createAdminClient } from "@/lib/supabase/admin";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} supabase
 * @param {string} workspaceId
 */
export async function fetchAiInstructions(supabase, workspaceId) {
  if (!workspaceId) {
    return [];
  }

  const client = supabase ?? createAdminClient();

  const { data, error } = await client
    .from("ai_instructions")
    .select("id, content, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/**
 * @param {{ content: string }[]} instructions
 */
export function formatInstructionsBlock(instructions) {
  if (!instructions?.length) {
    return "";
  }

  const lines = instructions.map((item, index) => `${index + 1}. ${item.content.trim()}`);

  return `Team AI instructions (apply to every email — these override default tone/style when they conflict):
${lines.join("\n")}`;
}

/**
 * Load a workspace's instructions and return a prompt block for AI calls.
 * Returns an empty block when no workspace is given, so instructions never leak across tenants.
 * @param {string} workspaceId
 * @param {import("@supabase/supabase-js").SupabaseClient} [supabase]
 */
export async function getAiInstructionsPromptBlock(workspaceId, supabase) {
  const instructions = await fetchAiInstructions(supabase, workspaceId);
  return formatInstructionsBlock(instructions);
}
