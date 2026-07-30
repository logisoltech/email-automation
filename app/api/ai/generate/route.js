import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { generateEmail } from "@/lib/ai";

const generateSchema = z.object({
  prompt: z.string().min(10, "Describe what you want the email to say (at least 10 characters)."),
  tone: z.string().optional(),
  audience: z.string().optional(),
});

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const result = await generateEmail(parsed.data.prompt, {
      tone: parsed.data.tone,
      audience: parsed.data.audience,
      workspaceId: session.workspace.id,
      supabase: session.supabase,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate email." },
      { status: 500 }
    );
  }
}
