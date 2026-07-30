import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const instructionSchema = z.object({
  content: z.string().min(1, "Instruction text is required.").max(4000),
});

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { data, error } = await session.supabase
    .from("ai_instructions")
    .select("id, content, created_at, updated_at")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ instructions: data ?? [] });
}

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

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
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.user.id,
      content: parsed.data.content.trim(),
    })
    .select("id, content, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ instruction: data });
}
