import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceId = session.workspace.id;

  const [emailsResult, campaignsResult, openedResult] = await Promise.all([
    session.supabase.from("emails").select("status").eq("workspace_id", workspaceId),
    session.supabase.from("campaigns").select("status").eq("workspace_id", workspaceId),
    session.supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "sent")
      .not("opened_at", "is", null),
  ]);

  if (emailsResult.error) {
    return NextResponse.json({ error: emailsResult.error.message }, { status: 500 });
  }

  const emails = emailsResult.data ?? [];
  const campaigns = campaignsResult.error ? [] : campaignsResult.data ?? [];
  const sent = emails.filter((row) => row.status === "sent").length;
  const opened = openedResult.error ? 0 : openedResult.count ?? 0;
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

  const stats = {
    sent,
    opened,
    openRate,
    failed: emails.filter((row) => row.status === "failed").length,
    scheduled:
      emails.filter((row) => row.status === "scheduled").length +
      campaigns.filter((row) => row.status === "scheduled").length,
    campaigns: campaigns.length,
    campaignSent: campaigns.filter((row) => row.status === "sent").length,
  };

  return NextResponse.json({ stats });
}
