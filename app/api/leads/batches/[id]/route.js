import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(request, { params }) {
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

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const { data: leads, error: leadsError } = await session.supabase
    .from("leads")
    .select("*")
    .eq("batch_id", id)
    .order("sort_order", { ascending: true });

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  const stats = {
    total: leads?.length ?? 0,
    pending: leads?.filter((l) => l.status === "pending").length ?? 0,
    generated: leads?.filter((l) => l.status === "generated").length ?? 0,
    queued: leads?.filter((l) => l.status === "queued").length ?? 0,
    sending: leads?.filter((l) => l.status === "sending").length ?? 0,
    sent: leads?.filter((l) => l.status === "sent").length ?? 0,
    failed: leads?.filter((l) => l.status === "failed").length ?? 0,
    skipped: leads?.filter((l) => l.status === "skipped").length ?? 0,
  };

  return NextResponse.json({ batch, leads: leads ?? [], stats });
}

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function DELETE(request, { params }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await session.supabase.from("lead_batches").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
