import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { generateEmail } from "@/lib/ai";

export async function POST() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  try {
    const result = await generateEmail(
      "Write a one-sentence test email confirming the AI provider is working.",
      {
        tone: "brief",
        audience: "internal team",
        workspaceId: session.workspace.id,
        supabase: session.supabase,
      }
    );

    return NextResponse.json({
      success: true,
      provider: result.provider,
      subject: result.subject,
      preview: result.bodyText.slice(0, 120),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI test failed." },
      { status: 500 }
    );
  }
}
