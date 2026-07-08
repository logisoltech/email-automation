import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { processDueScheduledItems } from "@/lib/email/scheduler";
import { formatProcessResultsMessage } from "@/lib/email/process-results";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await processDueScheduledItems({ drainLeads: true });
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
