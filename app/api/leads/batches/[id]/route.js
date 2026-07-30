import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  if (!batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number(searchParams.get("pageSize")) || 10)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [leadsResult, statusesResult] = await Promise.all([
    session.supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("batch_id", batch.id)
      .order("sort_order", { ascending: true })
      .range(from, to),
    session.supabase
      .from("leads")
      .select("status")
      .eq("batch_id", batch.id),
  ]);

  if (leadsResult.error) {
    return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  }

  const statuses = statusesResult.data ?? [];
  const stats = {
    total: statuses.length,
    pending: statuses.filter((l) => l.status === "pending").length,
    generated: statuses.filter((l) => l.status === "generated").length,
    queued: statuses.filter((l) => l.status === "queued").length,
    sending: statuses.filter((l) => l.status === "sending").length,
    sent: statuses.filter((l) => l.status === "sent").length,
    failed: statuses.filter((l) => l.status === "failed").length,
    skipped: statuses.filter((l) => l.status === "skipped").length,
  };

  const total = leadsResult.count ?? statuses.length;
  return NextResponse.json({
    batch,
    leads: leadsResult.data ?? [],
    stats,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function DELETE(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const { error } = await session.supabase
    .from("lead_batches")
    .delete()
    .eq("id", id)
    .eq("workspace_id", session.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
