import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { getActiveProvider } from "@/lib/ai";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";

const sendSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  bodyText: z.string().min(1, "Email body is required."),
  bodyHtml: z.string().optional(),
  recipients: z
    .array(z.string().email())
    .min(1, "Add at least one recipient."),
  aiPrompt: z.string().optional(),
});

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { subject, bodyText, bodyHtml, recipients, aiPrompt } = parsed.data;

  try {
    const { html, bodyText: text } = await deliverEmail({
      subject,
      bodyText,
      bodyHtml,
      recipients,
    });

    const { data, error } = await session.supabase
      .from("emails")
      .insert({
        sent_by: session.user.id,
        subject,
        body_html: html,
        body_text: text,
        recipients,
        status: "sent",
        ai_provider: getActiveProvider(),
        ai_prompt: aiPrompt || null,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Email sent but failed to save history: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    const message = formatSmtpError(error);

    await session.supabase.from("emails").insert({
      sent_by: session.user.id,
      subject,
      body_html: bodyHtml || bodyText,
      body_text: bodyText,
      recipients,
      status: "failed",
      ai_provider: getActiveProvider(),
      ai_prompt: aiPrompt || null,
      error_message: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
