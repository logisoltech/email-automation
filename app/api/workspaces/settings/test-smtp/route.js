import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getWorkspaceSettings } from "@/lib/workspaces";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";

export async function POST() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  const settings = await getWorkspaceSettings(session.supabase, session.workspace.id);

  if (!settings?.smtp_configured) {
    return NextResponse.json(
      { error: "Save your SMTP settings before testing." },
      { status: 400 }
    );
  }

  try {
    await deliverEmail({
      subject: `SMTP test from ${session.workspace.name}`,
      bodyText: `This is a test email from your ${session.workspace.name} workspace. SMTP is configured correctly.`,
      bodyHtml: `<p>This is a test email from your <strong>${session.workspace.name}</strong> workspace. SMTP is configured correctly.</p>`,
      recipients: [session.user.email],
      settings,
    });

    await session.supabase
      .from("workspace_settings")
      .update({
        smtp_last_tested_at: new Date().toISOString(),
        smtp_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", session.workspace.id);

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${session.user.email}.`,
    });
  } catch (err) {
    const message = formatSmtpError(err);

    await session.supabase
      .from("workspace_settings")
      .update({
        smtp_last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", session.workspace.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
