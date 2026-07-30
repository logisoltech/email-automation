import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { processDueScheduledItems } from "@/lib/email/scheduler";
import { formatProcessResultsMessage } from "@/lib/email/process-results";

export async function POST() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  try {
    const results = await processDueScheduledItems({
      drainLeads: true,
      workspaceId: session.workspace.id,
    });
    const processed =
      results.emails.length + results.campaigns.length + results.leads.length;

    return NextResponse.json({
      success: true,
      processed,
      results,
      message: formatProcessResultsMessage(results),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process scheduled items.",
      },
      { status: 500 }
    );
  }
}
