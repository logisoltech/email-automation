import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { signatureFromSettings, withEmailSignature } from "@/lib/email/signature";
import { getWorkspaceSettings } from "@/lib/workspaces";

const updateSchema = z.object({
  subject: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  status: z.enum(["generated", "skipped"]).optional(),
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
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;

  const { data: existing, error: existingError } = await session.supabase
    .from("leads")
    .select("id, batch_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { data: batch, error: batchError } = await session.supabase
    .from("lead_batches")
    .select("id")
    .eq("id", existing.batch_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  if (!batch) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const updates = {};

  if (parsed.data.subject !== undefined) updates.subject = parsed.data.subject;
  if (parsed.data.bodyText !== undefined) {
    const settings = await getWorkspaceSettings(session.supabase, workspaceId);
    const signed = withEmailSignature(
      {
        bodyText: parsed.data.bodyText,
        bodyHtml: parsed.data.bodyHtml,
      },
      signatureFromSettings(settings)
    );
    updates.body_text = signed.bodyText;
    updates.body_html = signed.bodyHtml;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const { data, error } = await session.supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("batch_id", batch.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
