import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  TEMPLATE_SELECT,
  listTemplatesEnsuringStarters,
  publicTemplate,
} from "@/lib/templates";

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

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  try {
    const { templates } = await listTemplatesEnsuringStarters(
      session.supabase,
      session.workspace.id,
      session.user.id
    );
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load templates." },
      { status: 500 }
    );
  }
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
  const branding = brandingFields(parsed.data);

  const { data, error } = await session.supabase
    .from("email_templates")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.user.id,
      name,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
      is_starter: false,
      ...branding,
    })
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: publicTemplate(data) });
}
