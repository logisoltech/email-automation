import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { generateLeadEmail } from "@/lib/ai/lead-email";
import { getWorkspaceSettings } from "@/lib/workspaces";
import { resolveLeadEmailType } from "@/lib/leads/categories";

const CHUNK_SIZE = 8;
const CONCURRENCY = 2;
const MAX_RETRIES = 4;

/** @type {Promise<void>} */
let rateLimitCooldown = Promise.resolve();

/**
 * @param {import("next/server").NextRequest} _request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function POST(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: campaign, error: campaignError } = await session.supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const settings = await getWorkspaceSettings(session.supabase, workspaceId);
  let leadType = campaign.lead_type === "smm" ? "smm" : "website";

  if (campaign.category_id) {
    const { data: category } = await session.supabase
      .from("lead_categories")
      .select("slug, name")
      .eq("id", campaign.category_id)
      .maybeSingle();
    leadType = resolveLeadEmailType({
      lead_type: campaign.lead_type,
      slug: category?.slug,
      name: category?.name,
    });
  } else {
    leadType = resolveLeadEmailType({ lead_type: campaign.lead_type });
  }

  await session.supabase
    .from("campaigns")
    .update({ status: "generating" })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  const { data: pendingRows, error: rowsError } = await session.supabase
    .from("campaign_leads")
    .select("id, lead_id, status, leads(*)")
    .eq("campaign_id", id)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(CHUNK_SIZE);

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  if (!pendingRows?.length) {
    await session.supabase
      .from("campaigns")
      .update({ status: "review" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json({ done: true, generated: 0, remaining: 0 });
  }

  const outcomes = await mapWithConcurrency(pendingRows, CONCURRENCY, async (row) => {
    const lead = row.leads;
    if (!lead) {
      return { ok: false, rateLimited: false, id: row.id, error: "Lead missing." };
    }

    try {
      const result = await generateLeadEmailWithRetry(
        leadType,
        {
          name: lead.name,
          country: lead.country,
          category: lead.category,
          projectDescription: lead.project_description,
          budget: lead.budget,
        },
        { workspaceId, settings, supabase: session.supabase }
      );

      await session.supabase
        .from("campaign_leads")
        .update({
          subject: result.subject,
          body_text: result.bodyText,
          body_html: result.bodyHtml,
          status: "generated",
          generated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", row.id);

      return { ok: true, id: row.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";

      if (isRateLimitError(error)) {
        await session.supabase
          .from("campaign_leads")
          .update({ status: "pending", error_message: null })
          .eq("id", row.id);
        return { ok: false, rateLimited: true, id: row.id, name: lead.name, error: message };
      }

      await session.supabase
        .from("campaign_leads")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);

      return { ok: false, rateLimited: false, id: row.id, name: lead.name, error: message };
    }
  });

  const generated = outcomes.filter((item) => item.ok).length;
  const errors = outcomes
    .filter((item) => !item.ok && !item.rateLimited)
    .map((item) => ({ id: item.id, name: item.name, error: item.error }));

  const { count: remaining } = await session.supabase
    .from("campaign_leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("status", "pending");

  const rateLimited = outcomes.some((item) => item.rateLimited);
  if (rateLimited && (remaining ?? 0) > 0) {
    await sleep(3500);
  }

  if ((remaining ?? 0) === 0) {
    await session.supabase
      .from("campaigns")
      .update({ status: "review" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
  }

  return NextResponse.json({
    done: (remaining ?? 0) === 0,
    generated,
    remaining: remaining ?? 0,
    errors,
  });
}

async function generateLeadEmailWithRetry(type, lead, options) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    await rateLimitCooldown;
    try {
      return await generateLeadEmail(type, lead, options);
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === MAX_RETRIES) throw error;
      const waitMs = getRetryWaitMs(error);
      const wait = sleep(waitMs);
      rateLimitCooldown = wait;
      await wait;
    }
  }

  throw lastError;
}

function isRateLimitError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate[_ ]?limit|quota|too many requests|tokens per minute|tpm/i.test(message);
}

function getRetryWaitMs(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000) + 500;
  return 3500;
}

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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );
  return results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
