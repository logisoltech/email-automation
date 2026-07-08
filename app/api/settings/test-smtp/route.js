import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await deliverEmail({
      subject: "Logisol Mail — SMTP test",
      bodyText:
        "This is a test email from your Logisol Mail settings page. SMTP is working correctly.",
      recipients: [session.user.email],
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
