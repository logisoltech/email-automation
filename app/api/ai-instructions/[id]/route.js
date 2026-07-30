import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const instructionSchema = z.object({
  content: z.string().min(1, "Instruction text is required.").max(4000),
});

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function PUT(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const body = await request.json();
  const parsed = instructionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { data, error } = await session.supabase
    .from("ai_instructions")
    .update({
      content: parsed.data.content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", session.workspace.id)
    .select("id, content, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Instruction not found." }, { status: 404 });
  }

  return NextResponse.json({ instruction: data });
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
    .from("ai_instructions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", session.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
