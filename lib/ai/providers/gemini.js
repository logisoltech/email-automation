import { buildEmailPrompt, parseEmailJson } from "@/lib/ai/prompt";

/**
 * @param {string} prompt
 * @param {{ tone?: string; audience?: string }} [context]
 */
export async function generateWithGemini(prompt, context) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildEmailPrompt(prompt, context) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 429) {
      throw new Error(
        "Gemini free-tier quota exceeded. Wait a minute and retry, set GEMINI_MODEL=gemini-2.0-flash-lite, or switch to Groq with AI_PROVIDER=groq in .env.local."
      );
    }

    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseEmailJson(text);
}
