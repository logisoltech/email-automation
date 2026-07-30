import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getActiveProvider } from "@/lib/ai";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";
import { wrapEmailHtml } from "@/lib/email/templates";
import { getWorkspaceSettings } from "@/lib/workspaces";

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required."),
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Email body is required."),
  bodyHtml: z.string().optional(),
  recipients: z.array(z.string().email()).min(1, "Add at least one recipient."),
  aiPrompt: z.string().optional(),
  scheduledAt: z.string().optional(),
  sendNow: z.boolean().optional(),
});

export async function GET(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await session.supabase
    .from("campaigns")
    .select(
      "id, name, subject, recipients, status, scheduled_at, sent_at, created_at, error_message",
      { count: "exact" }
    )
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    campaigns: data ?? [],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = campaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { name, subject, bodyText, bodyHtml, recipients, aiPrompt, scheduledAt, sendNow } =
    parsed.data;
  const workspaceId = session.workspace.id;
  const html = wrapEmailHtml(bodyHtml || bodyText.replace(/\n/g, "<br>"));

  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
  }

  if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Schedule time must be in the future." }, { status: 400 });
  }

  const { data: campaign, error: insertError } = await session.supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      created_by: session.user.id,
      name,
      subject,
      body_html: html,
      body_text: bodyText,
      recipients,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt || null,
      ai_provider: getActiveProvider(),
      ai_prompt: aiPrompt || null,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (!sendNow && scheduledAt) {
    return NextResponse.json({ success: true, campaign, scheduled: true });
  }

  if (!sendNow) {
    return NextResponse.json({ success: true, campaign, draft: true });
  }

  const settings = await getWorkspaceSettings(session.supabase, workspaceId);

  try {
    await deliverEmail({ subject, bodyText, bodyHtml: html, recipients, settings });

    const { data: updated, error: updateError } = await session.supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await session.supabase.from("emails").insert({
      workspace_id: workspaceId,
      sent_by: session.user.id,
      campaign_id: campaign.id,
      subject,
      body_html: html,
      body_text: bodyText,
      recipients,
      status: "sent",
      ai_provider: getActiveProvider(),
      ai_prompt: aiPrompt || null,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    const message = formatSmtpError(error);

    await session.supabase
      .from("campaigns")
      .update({ status: "failed", error_message: message })
      .eq("id", campaign.id)
      .eq("workspace_id", workspaceId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
