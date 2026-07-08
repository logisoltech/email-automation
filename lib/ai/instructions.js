import { createAdminClient } from "@/lib/supabase/admin";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} [supabase]
 */
export async function fetchAiInstructions(supabase) {
  const client = supabase ?? createAdminClient();

  const { data, error } = await client
    .from("ai_instructions")
    .select("id, content, created_at, updated_at")
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
 * Load instructions and return a prompt block for AI calls.
 */
export async function getAiInstructionsPromptBlock() {
  const instructions = await fetchAiInstructions();
  return formatInstructionsBlock(instructions);
}
