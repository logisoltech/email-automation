import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getWorkspaceSettings } from "@/lib/workspaces";
import { isDeliveryReady } from "@/lib/workspaces/delivery";

/**
 * Queue generated campaign leads and mark campaign as sending.
 * @param {import("next/server").NextRequest} _request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function POST(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: campaign } = await session.supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  if (!["review", "draft", "sending"].includes(campaign.status)) {
    return NextResponse.json(
      { error: "Campaign must be in review before sending." },
      { status: 400 }
    );
  }

  const settings = await getWorkspaceSettings(session.supabase, workspaceId);
  if (!isDeliveryReady(settings) && !process.env.SMTP_HOST) {
    return NextResponse.json(
      { error: "Configure SMTP or verify your domain in Settings before sending." },
      { status: 400 }
    );
  }

  const { count: generatedCount } = await session.supabase
    .from("campaign_leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("status", "generated");

  if (!(generatedCount > 0)) {
    return NextResponse.json(
      { error: "Generate personalized emails before sending." },
      { status: 400 }
    );
  }

  const { error: queueError } = await session.supabase
    .from("campaign_leads")
    .update({ status: "queued", error_message: null })
    .eq("campaign_id", id)
    .eq("status", "generated");

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  await session.supabase
    .from("campaigns")
    .update({ status: "sending", error_message: null })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  return NextResponse.json({ success: true, queued: generatedCount });
}
