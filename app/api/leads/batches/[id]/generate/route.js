import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { generateLeadEmail } from "@/lib/ai/lead-email";

const CHUNK_SIZE = 8;
/** Keep low to stay under Groq free-tier TPM (12k/min). */
const CONCURRENCY = 2;
const MAX_RETRIES = 4;

/**
 * Shared cooldown — when any worker hits rate limit, others wait too.
 * @type {Promise<void>}
 */
let rateLimitCooldown = Promise.resolve();

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function POST(request, { params }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .select("*")
    .eq("id", id)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const { data: pendingLeads, error: leadsError } = await session.supabase
    .from("leads")
    .select("*")
    .eq("batch_id", id)
    .in("status", ["pending", "failed"])
    .order("sort_order", { ascending: true })
    .limit(CHUNK_SIZE);

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  if (!pendingLeads?.length) {
    await session.supabase
      .from("lead_batches")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ done: true, generated: 0, remaining: 0 });
  }

  const outcomes = await mapWithConcurrency(pendingLeads, CONCURRENCY, async (lead) => {
    try {
      const result = await generateLeadEmailWithRetry(batch.type, {
        name: lead.name,
        country: lead.country,
        category: lead.category,
        projectDescription: lead.project_description,
        budget: lead.budget,
      });

      await session.supabase
        .from("leads")
        .update({
          subject: result.subject,
          body_text: result.bodyText,
          body_html: result.bodyHtml,
          status: "generated",
          generated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", lead.id);

      return { ok: true, leadId: lead.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";

      // Leave rate-limited leads as pending so the next round retries them.
      if (isRateLimitError(error)) {
        await session.supabase
          .from("leads")
          .update({ status: "pending", error_message: null })
          .eq("id", lead.id);

        return { ok: false, rateLimited: true, leadId: lead.id, name: lead.name, error: message };
      }

      await session.supabase
        .from("leads")
        .update({ status: "failed", error_message: message })
        .eq("id", lead.id);

      return { ok: false, rateLimited: false, leadId: lead.id, name: lead.name, error: message };
    }
  });

  const generated = outcomes.filter((item) => item.ok).length;
  const errors = outcomes
    .filter((item) => !item.ok && !item.rateLimited)
    .map((item) => ({ leadId: item.leadId, name: item.name, error: item.error }));

  const { count: remaining, error: countError } = await session.supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", id)
    .eq("status", "pending");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const rateLimited = outcomes.some((item) => item.rateLimited);
  if (rateLimited && (remaining ?? 0) > 0) {
    await sleep(3500);
  }

  if (remaining === 0) {
    await session.supabase
      .from("lead_batches")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    await session.supabase
      .from("lead_batches")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({
    done: remaining === 0,
    generated,
    remaining: remaining ?? 0,
    errors,
  });
}

/**
 * @param {'website' | 'smm'} type
 * @param {{ name: string; country?: string; category?: string; projectDescription?: string; budget?: string }} lead
 */
async function generateLeadEmailWithRetry(type, lead) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    await rateLimitCooldown;

    try {
      return await generateLeadEmail(type, lead);
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const waitMs = getRetryWaitMs(error);
      const wait = sleep(waitMs);
      rateLimitCooldown = wait;
      await wait;
    }
  }

  throw lastError;
}

/**
 * @param {unknown} error
 */
function isRateLimitError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate[_ ]?limit|quota|too many requests|tokens per minute|tpm/i.test(message);
}

/**
 * Parse Groq's "Please try again in 3.08s" hint.
 * @param {unknown} error
 */
function getRetryWaitMs(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*s/i);

  if (match) {
    return Math.ceil(Number(match[1]) * 1000) + 500;
  }

  return 3500;
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
