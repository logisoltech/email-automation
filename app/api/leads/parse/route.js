import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLeadsPaste } from "@/lib/leads/parse";

const parseSchema = z.object({
  raw: z.string().min(1, "Paste your leads first."),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = parseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const result = parseLeadsPaste(parsed.data.raw);

    return NextResponse.json({
      leads: result.leads,
      errors: result.errors,
      count: result.leads.length,
      meta: result.meta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse leads." },
      { status: 500 }
    );
  }
}
