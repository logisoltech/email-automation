import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { withEmailSignature } from "@/lib/email/signature";

const updateSchema = z.object({
  subject: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  status: z.enum(["generated", "skipped"]).optional(),
});

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function PUT(request, { params }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const updates = {};

  if (parsed.data.subject !== undefined) updates.subject = parsed.data.subject;
  if (parsed.data.bodyText !== undefined) {
    const signed = withEmailSignature({
      bodyText: parsed.data.bodyText,
      bodyHtml: parsed.data.bodyHtml,
    });
    updates.body_text = signed.bodyText;
    updates.body_html = signed.bodyHtml;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const { data, error } = await session.supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
