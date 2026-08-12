import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { ensureDefaultLeadCategories } from "@/lib/leads/categories";
import { createImportRun, finalizeImportRun } from "@/lib/leads/import-run";

const leadSchema = z.object({
  sortOrder: z.number().optional(),
  leadDate: z.string().optional(),
  name: z.string().min(1),
  country: z.string().optional(),
  category: z.string().optional(),
  emails: z.array(z.string().email()).min(1),
  phone: z.string().optional().nullable(),
  projectDescription: z.string().optional(),
  budget: z.string().optional(),
});

const importSchema = z.object({
  categoryId: z.string().uuid("Pick a subcategory."),
  name: z.string().optional(),
  leads: z.array(leadSchema).min(1, "Add at least one lead."),
});

/**
 * Import-only: paste-parsed leads land in a subcategory (no AI, no send).
 */
export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  await ensureDefaultLeadCategories(session.supabase, workspaceId);

  const { categoryId, leads, name } = parsed.data;

  const { data: category, error: categoryError } = await session.supabase
    .from("lead_categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (categoryError || !category) {
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }

  const batchType = category.slug === "smm" ? "smm" : "website";
  const batchName =
    name?.trim() ||
    `Import ${category.name} · ${new Date().toLocaleDateString()}`;

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .insert({
      workspace_id: workspaceId,
      created_by: session.user.id,
      type: batchType,
      name: batchName,
      status: "completed",
      sends_per_hour: session.workspace.sends_per_hour ?? 100,
    })
    .select("id")
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  let importRunId = null;
  try {
    importRunId = await createImportRun(session.supabase, {
      workspaceId,
      userId: session.user.id,
      source: "paste",
      categoryId,
      leadCount: leads.length,
    });
  } catch (err) {
    await session.supabase.from("lead_batches").delete().eq("id", batch.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start import run." },
      { status: 500 }
    );
  }

  const rows = leads.map((lead, index) => ({
    workspace_id: workspaceId,
    batch_id: batch.id,
    import_run_id: importRunId,
    category_id: categoryId,
    sort_order: lead.sortOrder ?? index,
    lead_date: lead.leadDate || null,
    name: lead.name,
    country: lead.country || null,
    category: lead.category || null,
    emails: lead.emails,
    phone: lead.phone || null,
    project_description: lead.projectDescription || null,
    budget: lead.budget || null,
    status: "pending",
  }));

  const { data: inserted, error: leadsError } = await session.supabase
    .from("leads")
    .insert(rows)
    .select("id");

  if (leadsError) {
    await session.supabase.from("lead_batches").delete().eq("id", batch.id);
    await session.supabase.from("lead_import_runs").delete().eq("id", importRunId);
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  const imported = inserted?.length ?? rows.length;
  await finalizeImportRun(session.supabase, importRunId, imported);

  return NextResponse.json({
    success: true,
    imported,
    batchId: batch.id,
    importRunId,
    categoryId,
  });
}
