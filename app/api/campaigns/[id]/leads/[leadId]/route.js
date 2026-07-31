import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { wrapEmailHtml } from "@/lib/email/templates";
import { signatureFromSettings, withEmailSignature } from "@/lib/email/signature";
import { getWorkspaceSettings } from "@/lib/workspaces";

const updateSchema = z.object({
  subject: z.string().optional(),
  bodyText: z.string().optional(),
  status: z.enum(["generated", "skipped"]).optional(),
});

/**
 * Edit one campaign recipient's email.
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string; leadId: string }> }} context
 */
export async function PUT(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id, leadId } = await params;
  const workspaceId = session.workspace.id;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { data: campaign } = await session.supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const { data: row } = await session.supabase
    .from("campaign_leads")
    .select("*")
    .eq("campaign_id", id)
    .eq("id", leadId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  }

  /** @type {Record<string, unknown>} */
  const patch = {};

  if (parsed.data.status === "skipped") {
    patch.status = "skipped";
  }

  if (parsed.data.subject !== undefined || parsed.data.bodyText !== undefined) {
    const settings = await getWorkspaceSettings(session.supabase, workspaceId);
    const subject = parsed.data.subject ?? row.subject ?? "";
    const bodyText = parsed.data.bodyText ?? row.body_text ?? "";
    const withSig = withEmailSignature(bodyText, signatureFromSettings(settings));
    patch.subject = subject;
    patch.body_text = withSig;
    patch.body_html = wrapEmailHtml(withSig.replace(/\n/g, "<br>"));
    if (row.status === "pending" || row.status === "failed") {
      patch.status = "generated";
    }
  }

  const { data: updated, error } = await session.supabase
    .from("campaign_leads")
    .update(patch)
    .eq("id", leadId)
    .eq("campaign_id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: updated });
}
