import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";
import { getWorkspaceSettings } from "@/lib/workspaces";

export async function POST() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const settings = await getWorkspaceSettings(session.supabase, session.workspace.id);

  try {
    await deliverEmail({
      subject: `${session.workspace.name} — SMTP test`,
      bodyText: `This is a test email from your ${session.workspace.name} workspace settings. SMTP is working correctly.`,
      recipients: [session.user.email],
      settings,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${session.user.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatSmtpError(error) },
      { status: 500 }
    );
  }
}
