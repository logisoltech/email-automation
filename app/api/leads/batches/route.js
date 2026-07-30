import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const leadSchema = z.object({
  sortOrder: z.number(),
  leadDate: z.string().optional(),
  name: z.string(),
  country: z.string().optional(),
  category: z.string().optional(),
  emails: z.array(z.string().email()).min(1),
  projectDescription: z.string().optional(),
  budget: z.string().optional(),
});

const createSchema = z.object({
  type: z.enum(["website", "smm"]),
  name: z.string().min(1, "Batch name is required."),
  leads: z.array(leadSchema).min(1, "Add at least one lead."),
  sendsPerHour: z.number().min(1).max(100).optional(),
});

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { data, error } = await session.supabase
    .from("lead_batches")
    .select("id, name, type, status, sends_per_hour, created_at, updated_at")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { type, name, leads, sendsPerHour } = parsed.data;
  const workspaceId = session.workspace.id;
  const workspaceQuota = session.workspace.sends_per_hour ?? 100;

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .insert({
      workspace_id: workspaceId,
      created_by: session.user.id,
      type,
      name,
      status: "generating",
      sends_per_hour: Math.min(sendsPerHour ?? workspaceQuota, workspaceQuota),
    })
    .select("*")
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const rows = leads.map((lead) => ({
    batch_id: batch.id,
    sort_order: lead.sortOrder,
    lead_date: lead.leadDate || null,
    name: lead.name,
    country: lead.country || null,
    category: lead.category || null,
    emails: lead.emails,
    phone: null,
    project_description: lead.projectDescription || null,
    budget: lead.budget || null,
    status: "pending",
  }));

  const { error: leadsError } = await session.supabase.from("leads").insert(rows);

  if (leadsError) {
    await session.supabase
      .from("lead_batches")
      .delete()
      .eq("id", batch.id)
      .eq("workspace_id", workspaceId);
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  return NextResponse.json({ batch });
}
