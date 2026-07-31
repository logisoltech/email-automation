import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

/**
 * @param {import("next/server").NextRequest} _request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: campaign, error } = await session.supabase
    .from("campaigns")
    .select(
      "id, name, subject, body_text, body_html, recipients, status, scheduled_at, sent_at, created_at, error_message, category_id, lead_type"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const { data: campaignLeads, error: clError } = await session.supabase
    .from("campaign_leads")
    .select(
      "id, lead_id, subject, body_text, body_html, status, error_message, sent_at, generated_at, leads(id, name, emails, phone, category, project_description, budget, lead_date, country)"
    )
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  if (clError) {
    return NextResponse.json({ error: clError.message }, { status: 500 });
  }

  const rows = campaignLeads ?? [];
  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    generated: rows.filter((r) => r.status === "generated").length,
    queued: rows.filter((r) => r.status === "queued").length,
    sending: rows.filter((r) => r.status === "sending").length,
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
  };

  let category = null;
  if (campaign.category_id) {
    const { data } = await session.supabase
      .from("lead_categories")
      .select("id, name, slug")
      .eq("id", campaign.category_id)
      .maybeSingle();
    category = data;
  }

  return NextResponse.json({
    campaign: { ...campaign, category },
    leads: rows,
    stats,
  });
}
