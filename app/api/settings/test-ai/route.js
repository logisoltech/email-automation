import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { generateEmail } from "@/lib/ai";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await generateEmail(
      "Write a one-sentence test email confirming the AI provider is working.",
      { tone: "brief", audience: "internal team" }
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
