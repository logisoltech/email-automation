import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getActiveProvider } from "@/lib/ai";
import {
  buildBrandedEmailHtml,
  buildBrandedEmailText,
  signatureFromSettings,
  resolveSignatureImageUrl,
} from "@/lib/email/signature";
import { getWorkspaceSettings } from "@/lib/workspaces";

const scheduleSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Email body is required."),
  bodyHtml: z.string().optional(),
  recipients: z.array(z.string().email()).min(1, "Add at least one recipient."),
  scheduledAt: z.string().min(1, "Pick a schedule time."),
  aiPrompt: z.string().optional(),
  logoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  signatureImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const {
    subject,
    bodyText,
    bodyHtml,
    recipients,
    scheduledAt,
    aiPrompt,
    logoUrl,
    signatureImageUrl,
  } = parsed.data;

  if (Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
  }

  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Schedule time must be in the future." },
      { status: 400 }
    );
  }

  const settings = await getWorkspaceSettings(session.supabase, session.workspace.id);
  const signature = signatureFromSettings(settings);
  const resolvedSigImage = resolveSignatureImageUrl(settings, signatureImageUrl);
  const brandedInner = buildBrandedEmailHtml({
    bodyText,
    bodyHtml,
    logoUrl: logoUrl || null,
    signatureImageUrl: resolvedSigImage,
    workspaceSignature: signature,
  });
  const text = buildBrandedEmailText(bodyText, signature, resolvedSigImage);
  // Store branded inner HTML (not full document) so deliverEmail wraps once on send
  const html = brandedInner;

  const { data, error } = await session.supabase
    .from("emails")
    .insert({
      workspace_id: session.workspace.id,
      sent_by: session.user.id,
      subject,
      body_html: html,
      body_text: text,
      recipients,
      status: "scheduled",
      scheduled_at: scheduledAt,
      ai_provider: getActiveProvider(),
      ai_prompt: aiPrompt || null,
    })
    .select("id, scheduled_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    id: data.id,
    scheduledAt: data.scheduled_at,
  });
}
