import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { slugifyCategoryName } from "@/lib/leads/categories";

const updateSchema = z.object({
  name: z.string().min(1).max(80),
});

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function PATCH(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  const name = parsed.data.name.trim();
  const slug = slugifyCategoryName(name);

  const { data, error } = await session.supabase
    .from("lead_categories")
    .update({ name, slug })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id, name, slug, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json({ category: data });
}

/**
 * @param {import("next/server").NextRequest} _request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function DELETE(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { count } = await session.supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("category_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Move or reassign leads before deleting this category." },
      { status: 400 }
    );
  }

  const { error } = await session.supabase
    .from("lead_categories")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
