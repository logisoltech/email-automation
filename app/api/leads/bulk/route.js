import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const bulkSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, "Select at least one lead."),
  categoryId: z.string().uuid("Pick a subcategory."),
});

/**
 * Assign many leads to a subcategory.
 */
export async function PATCH(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = bulkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  const { leadIds, categoryId } = parsed.data;

  const { data: category } = await session.supabase
    .from("lead_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }

  const { data, error } = await session.supabase
    .from("leads")
    .update({ category_id: categoryId })
    .eq("workspace_id", workspaceId)
    .in("id", leadIds)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
