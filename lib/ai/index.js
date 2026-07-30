import { generateWithGemini } from "@/lib/ai/providers/gemini";
import { generateWithGroq } from "@/lib/ai/providers/groq";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";
import { getAiInstructionsPromptBlock } from "@/lib/ai/instructions";

const providers = {
  gemini: generateWithGemini,
  groq: generateWithGroq,
  openai: generateWithOpenAI,
};

/**
 * @param {string} prompt
 * @param {{
 *   tone?: string;
 *   audience?: string;
 *   workspaceId?: string;
 *   supabase?: import("@supabase/supabase-js").SupabaseClient;
 * }} [context]
 */
export async function generateEmail(prompt, context = {}) {
  const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerName}. Use gemini, groq, or openai.`);
  }

  const { workspaceId, supabase, ...promptContext } = context;
  const instructionsBlock = await getAiInstructionsPromptBlock(workspaceId, supabase);

  const result = await provider(prompt, {
    ...promptContext,
    instructionsBlock,
  });

  return {
    ...result,
    provider: providerName,
  };
}

export function getActiveProvider() {
  return (process.env.AI_PROVIDER || "gemini").toLowerCase();
}
