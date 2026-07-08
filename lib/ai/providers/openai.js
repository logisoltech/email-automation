import { buildEmailPrompt, parseEmailJson } from "@/lib/ai/prompt";

/**
 * @param {string} prompt
 * @param {{ tone?: string; audience?: string }} [context]
 */
export async function generateWithOpenAI(prompt, context) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildEmailPrompt(prompt, context),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 429) {
      throw new Error("OpenAI rate limit exceeded. Wait a moment and retry.");
    }

    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return parseEmailJson(text);
}
