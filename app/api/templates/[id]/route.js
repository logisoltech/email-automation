import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required."),
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Body is required."),
  bodyHtml: z.string().optional(),
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
  const parsed = templateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { name, subject, bodyText, bodyHtml } = parsed.data;

  const { data, error } = await session.supabase
    .from("email_templates")
    .update({
      name,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", session.workspace.id)
    .select("id, name, subject, body_text, body_html, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ template: data });
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
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", session.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
