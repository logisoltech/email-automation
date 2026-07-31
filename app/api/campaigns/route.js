import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  CAMPAIGN_MAX_LEADS,
  ensureDefaultLeadCategories,
  resolveLeadEmailType,
} from "@/lib/leads/categories";

const createFromLeadsSchema = z.object({
  name: z.string().min(1, "Campaign name is required."),
  categoryId: z.string().uuid("Pick a subcategory."),
  leadIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one lead.")
    .max(CAMPAIGN_MAX_LEADS, `Select at most ${CAMPAIGN_MAX_LEADS} leads.`),
});

export async function GET(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await session.supabase
    .from("campaigns")
    .select(
      "id, name, subject, recipients, status, scheduled_at, sent_at, created_at, error_message, category_id, lead_type",
      { count: "exact" }
    )
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const campaigns = data ?? [];
  const withCounts = await Promise.all(
    campaigns.map(async (campaign) => {
      const { count: leadCount } = await session.supabase
        .from("campaign_leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      return {
        ...campaign,
        recipientCount: leadCount ?? campaign.recipients?.length ?? 0,
      };
    })
  );

  const total = count ?? 0;
  return NextResponse.json({
    campaigns: withCounts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/**
 * Create a lead-based campaign (personalized AI flow).
 */
export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = createFromLeadsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  await ensureDefaultLeadCategories(session.supabase, workspaceId);

  const { name, categoryId, leadIds } = parsed.data;
  const uniqueLeadIds = [...new Set(leadIds)];

  if (uniqueLeadIds.length > CAMPAIGN_MAX_LEADS) {
    return NextResponse.json(
      { error: `Select at most ${CAMPAIGN_MAX_LEADS} leads.` },
      { status: 400 }
    );
  }

  const { data: category } = await session.supabase
    .from("lead_categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }

  const { data: leads, error: leadsError } = await session.supabase
    .from("leads")
    .select("id, emails, name")
    .eq("workspace_id", workspaceId)
    .eq("category_id", categoryId)
    .in("id", uniqueLeadIds);

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  if (!leads?.length || leads.length !== uniqueLeadIds.length) {
    return NextResponse.json(
      { error: "Some selected leads were not found in that subcategory." },
      { status: 400 }
    );
  }

  const leadType = resolveLeadEmailType(category);
  const recipients = leads.flatMap((lead) => lead.emails || []);

  const { data: campaign, error: insertError } = await session.supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      created_by: session.user.id,
      name,
      subject: "",
      body_html: "",
      body_text: "",
      recipients,
      status: "draft",
      category_id: categoryId,
      lead_type: leadType,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const rows = leads.map((lead) => ({
    campaign_id: campaign.id,
    lead_id: lead.id,
    status: "pending",
  }));

  const { error: clError } = await session.supabase.from("campaign_leads").insert(rows);

  if (clError) {
    await session.supabase.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: clError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    campaign,
    leadCount: rows.length,
  });
}
