import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { generateLeadEmail } from "@/lib/ai/lead-email";

const CHUNK_SIZE = 5;

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

  let generated = 0;
  const errors = [];

  for (const lead of pendingLeads) {
    try {
      const result = await generateLeadEmail(batch.type, {
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

      generated += 1;

      await sleep(1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      errors.push({ leadId: lead.id, name: lead.name, error: message });

      await session.supabase
        .from("leads")
        .update({ status: "failed", error_message: message })
        .eq("id", lead.id);
    }
  }

  const { count: remaining, error: countError } = await session.supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", id)
    .eq("status", "pending");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
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
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
