import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [emailsResult, campaignsResult] = await Promise.all([
    session.supabase.from("emails").select("status"),
    session.supabase.from("campaigns").select("status"),
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
