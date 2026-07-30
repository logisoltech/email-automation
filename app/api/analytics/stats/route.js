import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceId = session.workspace.id;

  const [emailsResult, campaignsResult] = await Promise.all([
    session.supabase.from("emails").select("status").eq("workspace_id", workspaceId),
    session.supabase.from("campaigns").select("status").eq("workspace_id", workspaceId),
  ]);

  if (emailsResult.error) {
    return NextResponse.json({ error: emailsResult.error.message }, { status: 500 });
  }

  const emails = emailsResult.data ?? [];
  const campaigns = campaignsResult.error ? [] : campaignsResult.data ?? [];

  const stats = {
    sent: emails.filter((row) => row.status === "sent").length,
    failed: emails.filter((row) => row.status === "failed").length,
    scheduled:
      emails.filter((row) => row.status === "scheduled").length +
      campaigns.filter((row) => row.status === "scheduled").length,
    campaigns: campaigns.length,
    campaignSent: campaigns.filter((row) => row.status === "sent").length,
  };

  return NextResponse.json({ stats });
}
