import { buildEmailPrompt, parseEmailJson, trySalvageGroqErrorResponse } from "@/lib/ai/prompt";

/**
 * @param {string} prompt
 * @param {{ tone?: string; audience?: string }} [context]
 */
export async function generateWithGroq(prompt, context) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    const error = await response.text();
    const salvaged = trySalvageGroqErrorResponse(error);
    if (salvaged) {
      return parseEmailJson(JSON.stringify(salvaged));
    }
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  return parseEmailJson(text);
}
