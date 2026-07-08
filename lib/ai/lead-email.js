import { parseEmailJson, trySalvageGroqErrorResponse } from "@/lib/ai/prompt";
import { getAiInstructionsPromptBlock } from "@/lib/ai/instructions";
import { withEmailSignature } from "@/lib/email/signature";
import { getBudgetTier } from "@/lib/leads/budget-tier";

/**
 * @param {'website' | 'smm'} type
 * @param {import("@/lib/leads/budget-tier").BudgetTier} tier
 */
function getTierInstructions(type, tier) {
  if (tier === "detailed") {
    return type === "website"
      ? `Email tier: HIGH BUDGET (over $1,000).
- Write a thorough, consultative email (about 200-280 words for the body only)
- Discuss their project in detail — break down what they are trying to build and why it matters
- Propose a clear solution approach: discovery call, MVP vs full build, tech direction, timeline at a high level
- Show expertise and confidence without over-promising
- Subject line should feel premium and specific to their project`
      : `Email tier: HIGH BUDGET (over $1,000).
- Write a thorough, consultative email (about 200-280 words for the body only)
- Discuss their business and goals in detail
- Propose a clear SMM solution: channels, content strategy, growth approach, and what results they can expect
- Show expertise and confidence without over-promising
- Subject line should feel premium and specific to their project`;
  }

  if (tier === "moderate") {
    return type === "website"
      ? `Email tier: MID BUDGET ($500-$1,000).
- Write a balanced email (about 120-180 words for the body only)
- Reference their project with moderate detail — show you understand the core idea
- Briefly explain how Logisol can help and suggest a short call to scope the work
- Keep it warm and credible, not overly long`
      : `Email tier: MID BUDGET ($500-$1,000).
- Write a balanced email (about 120-180 words for the body only)
- Reference their business/project with moderate detail
- Briefly explain relevant SMM services and suggest a short call to discuss fit
- Keep it warm and credible, not overly long`;
  }

  return type === "website"
    ? `Email tier: STANDARD (under $500 or unclear budget).
- Write a short, simple outreach email (under 120 words for the body only)
- Mention their project briefly in one or two sentences
- Keep the tone friendly and light — invite a quick reply or call without heavy detail`
    : `Email tier: STANDARD (under $500 or unclear budget).
- Write a short, simple outreach email (under 120 words for the body only)
- Mention their business/project briefly in one or two sentences
- Keep the tone friendly and light — invite a quick reply or call without heavy detail`;
}

/**
 * @param {'website' | 'smm'} type
 * @param {{
 *   name: string;
 *   country?: string;
 *   category?: string;
 *   projectDescription?: string;
 *   budget?: string;
 * }} lead
 * @param {string} [instructionsBlock]
 */
export function buildLeadEmailPrompt(type, lead, instructionsBlock = "") {
  const tier = getBudgetTier(lead.budget);
  const serviceLine =
    type === "website"
      ? "Logisol (logisol.tech) — a software development company that builds websites, mobile apps, and custom software for businesses."
      : "Logisol (logisol.tech) — a digital marketing team offering social media management (SMM), content, and growth for businesses.";

  const outreachGoal =
    type === "website"
      ? "Offer to help them build their app, website, or software project."
      : "Offer SMM and social media growth services relevant to their business or project.";

  return `You write personalized cold outreach emails for ${serviceLine}

${outreachGoal}

${getTierInstructions(type, tier)}
${instructionsBlock ? `\n${instructionsBlock}\n` : ""}
Lead details:
- Name: ${lead.name}
- Country: ${lead.country || "Unknown"}
- Category: ${lead.category || "Unknown"}
- Budget: ${lead.budget || "Not specified"}
- What they want: ${lead.projectDescription || "Not specified"}

Rules:
- Address them by first name
- Reference their specific project/need — show you read it
- Professional, warm, not pushy
- Include a soft CTA (reply or quick call)
- Do NOT mention you scraped their data
- Do NOT include a sign-off or signature — one will be appended automatically after your text
- End the body with the CTA, not "Best regards" or a name
- Use 3-5 short paragraphs in bodyText, separated by blank lines (double newlines)
- Do NOT include HTML tags in bodyText — plain text only

Respond with valid JSON only — subject and bodyText only (HTML is generated separately):
{
  "subject": "personalized subject line matching the email tier",
  "bodyText": "plain text with paragraphs separated by blank lines (\\n\\n)"
}`;
}

/**
 * @param {string} errorText
 */
function trySalvageGroqError(errorText) {
  const salvaged = trySalvageGroqErrorResponse(errorText);
  return salvaged;
}

/**
 * @param {string} prompt
 * @param {string} providerName
 */
async function callGroq(prompt, providerName) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const model =
    process.env.GROQ_MODEL ||
    (providerName === "groq" ? "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile");

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const salvaged = trySalvageGroqError(errorText);
    if (salvaged) {
      return JSON.stringify(salvaged);
    }
    throw new Error(`Groq API error: ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty AI response.");
  return text;
}

/**
 * @param {string} prompt
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty AI response.");
  return text;
}

/**
 * @param {string} prompt
 */
async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty AI response.");
  return text;
}

/**
 * @param {'website' | 'smm'} type
 * @param {Parameters<typeof buildLeadEmailPrompt>[1]} lead
 */
export async function generateLeadEmail(type, lead) {
  const providerName = (process.env.AI_PROVIDER || "groq").toLowerCase();
  const budgetTier = getBudgetTier(lead.budget);
  const instructionsBlock = await getAiInstructionsPromptBlock();
  const prompt = buildLeadEmailPrompt(type, lead, instructionsBlock);

  let raw;

  if (providerName === "gemini") {
    raw = await callGemini(prompt);
  } else if (providerName === "openai") {
    raw = await callOpenAI(prompt);
  } else {
    raw = await callGroq(prompt, providerName);
  }

  const parsed = parseEmailJson(raw);
  const signed = withEmailSignature(parsed);

  return {
    subject: parsed.subject,
    bodyText: signed.bodyText,
    bodyHtml: signed.bodyHtml,
    provider: providerName,
    budgetTier,
  };
}
