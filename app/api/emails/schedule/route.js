import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { getActiveProvider } from "@/lib/ai";
import { wrapEmailHtml } from "@/lib/email/templates";

const scheduleSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Email body is required."),
  bodyHtml: z.string().optional(),
  recipients: z.array(z.string().email()).min(1, "Add at least one recipient."),
  scheduledAt: z.string().min(1, "Pick a schedule time."),
  aiPrompt: z.string().optional(),
});

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { subject, bodyText, bodyHtml, recipients, scheduledAt, aiPrompt } = parsed.data;

  if (Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
  }

  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Schedule time must be in the future." },
      { status: 400 }
    );
  }

  const html = wrapEmailHtml(bodyHtml || bodyText.replace(/\n/g, "<br>"));

  const { data, error } = await session.supabase
    .from("emails")
    .insert({
      sent_by: session.user.id,
      subject,
      body_html: html,
      body_text: bodyText,
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
