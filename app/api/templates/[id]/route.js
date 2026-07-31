import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { TEMPLATE_SELECT, publicTemplate } from "@/lib/templates";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required."),
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Body is required."),
  bodyHtml: z.string().optional(),
  logoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  signatureImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});

/**
 * @param {z.infer<typeof templateSchema>} data
 */
function brandingFields(data) {
  return {
    logo_url: data.logoUrl === "" || data.logoUrl === undefined ? null : data.logoUrl,
    signature_image_url:
      data.signatureImageUrl === "" || data.signatureImageUrl === undefined
        ? null
        : data.signatureImageUrl,
  };
}

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
  const branding = brandingFields(parsed.data);

  const { data, error } = await session.supabase
    .from("email_templates")
    .update({
      name,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
      updated_at: new Date().toISOString(),
      ...branding,
    })
    .eq("id", id)
    .eq("workspace_id", session.workspace.id)
    .select(TEMPLATE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ template: publicTemplate(data) });
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
