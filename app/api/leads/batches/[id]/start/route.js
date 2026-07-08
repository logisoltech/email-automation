import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

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

  if (batch.status !== "review" && batch.status !== "paused") {
    return NextResponse.json(
      { error: "Batch must be in review before sending." },
      { status: 400 }
    );
  }

  const { data: generatedLeads, error: countError } = await session.supabase
    .from("leads")
    .select("id")
    .eq("batch_id", id)
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
    .eq("batch_id", id)
    .eq("status", "generated");

  await session.supabase
    .from("lead_batches")
    .update({
      status: "sending",
      last_send_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    success: true,
    queued: generatedLeads.length,
    sendsPerHour: batch.sends_per_hour,
  });
}
