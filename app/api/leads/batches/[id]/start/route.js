import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getWorkspaceSettings } from "@/lib/workspaces";
import { isDeliveryReady } from "@/lib/workspaces/delivery";

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function POST(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  if (batch.status !== "review" && batch.status !== "paused") {
    return NextResponse.json(
      { error: "Batch must be in review before sending." },
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

  const { data: generatedLeads, error: countError } = await session.supabase
    .from("leads")
    .select("id")
    .eq("batch_id", batch.id)
    .eq("status", "generated");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (!generatedLeads?.length) {
    return NextResponse.json(
      { error: "No emails ready to send. Generate or un-skip leads first." },
      { status: 400 }
    );
  }

  await session.supabase
    .from("leads")
    .update({ status: "queued" })
    .eq("batch_id", batch.id)
    .eq("status", "generated");

  await session.supabase
    .from("lead_batches")
    .update({
      status: "sending",
      last_send_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .eq("workspace_id", workspaceId);

  return NextResponse.json({
    success: true,
    queued: generatedLeads.length,
    sendsPerHour: batch.sends_per_hour,
  });
}
