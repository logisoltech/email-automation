import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required."),
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Body is required."),
  bodyHtml: z.string().optional(),
});

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { data, error } = await session.supabase
    .from("email_templates")
    .select("id, name, subject, body_text, body_html, created_at, updated_at")
    .eq("workspace_id", session.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

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
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.user.id,
      name,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
    })
    .select("id, name, subject, body_text, body_html, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
