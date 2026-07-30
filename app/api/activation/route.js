import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceSettings } from "@/lib/workspaces";

/**
 * Build derived first-win checklist for the active workspace.
 */
async function buildActivation(session) {
  const workspaceId = session.workspace.id;
  const isOwner = session.workspace.role === "owner";
  const admin = createAdminClient();

  const { data: workspaceRow } = await admin
    .from("workspaces")
    .select("activation_dismissed_at, sends_per_hour")
    .eq("id", workspaceId)
    .maybeSingle();

  const settings = await getWorkspaceSettings(session.supabase, workspaceId);
  const smtpConfigured = Boolean(settings?.smtp_configured);

  const [{ count: batchCount }, { count: memberCount }, { count: inviteCount }] =
    await Promise.all([
      session.supabase
        .from("lead_batches")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      session.supabase
        .from("workspace_members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      session.supabase
        .from("workspace_invitations")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);

  const { data: batchIds } = await session.supabase
    .from("lead_batches")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(200);

  let hasGenerated = false;
  if (batchIds?.length) {
    const { count: generatedCount } = await session.supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .in(
        "batch_id",
        batchIds.map((b) => b.id)
      )
      .in("status", ["generated", "queued", "sending", "sent"]);
    hasGenerated = (generatedCount ?? 0) > 0;
  }

  const [{ count: sentEmails }, { count: sentLeads }] = await Promise.all([
    session.supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "sent"),
    batchIds?.length
      ? session.supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .in(
            "batch_id",
            batchIds.map((b) => b.id)
          )
          .eq("status", "sent")
      : Promise.resolve({ count: 0 }),
  ]);

  const hasSent = (sentEmails ?? 0) > 0 || (sentLeads ?? 0) > 0;
  const hasImported = (batchCount ?? 0) > 0;
  const hasTeammate = (memberCount ?? 0) > 1 || (inviteCount ?? 0) > 0;

  /** @type {Array<{ id: string; title: string; hint: string; href: string; done: boolean; hidden?: boolean }>} */
  const steps = [];

  if (isOwner) {
    steps.push({
      id: "smtp",
      title: "Connect SMTP",
      hint: "Add your mailbox so emails send from your domain.",
      href: "/settings",
      done: smtpConfigured,
    });
  }

  steps.push(
    {
      id: "import",
      title: "Import leads",
      hint: "Paste a few rows from Sheets to create your first batch.",
      href: "/import/website",
      done: hasImported,
    },
    {
      id: "generate",
      title: "Generate with AI",
      hint: "Let AI write personalized emails for your leads.",
      href: hasImported ? "/import/website" : "/import/website",
      done: hasGenerated,
    },
    {
      id: "send",
      title: "Send your first email",
      hint: "Queue a batch or send a one-off from Compose.",
      href: hasGenerated ? "/import/website" : "/compose",
      done: hasSent,
    }
  );

  if (isOwner) {
    steps.push({
      id: "invite",
      title: "Invite a teammate",
      hint: "Share the workspace so your team can collaborate.",
      href: "/settings#team",
      done: hasTeammate,
    });
  }

  const doneCount = steps.filter((s) => s.done).length;
  const complete = steps.length > 0 && doneCount === steps.length;
  const dismissed = Boolean(workspaceRow?.activation_dismissed_at);

  return {
    steps,
    doneCount,
    totalCount: steps.length,
    complete,
    dismissed,
    visible: !dismissed && !complete,
    sendsPerHour: workspaceRow?.sends_per_hour ?? session.workspace.sends_per_hour ?? 100,
    isOwner,
  };
}

export async function GET() {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  try {
    const activation = await buildActivation(session);
    return NextResponse.json({ activation });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load activation." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  if (!body?.dismiss) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("workspaces")
    .update({ activation_dismissed_at: new Date().toISOString() })
    .eq("id", session.workspace.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, dismissed: true });
}
