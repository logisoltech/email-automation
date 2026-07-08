import { NextResponse } from "next/server";
import { processDueScheduledItems } from "@/lib/email/scheduler";
import { formatProcessResultsMessage } from "@/lib/email/process-results";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await processDueScheduledItems();
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
        error: error instanceof Error ? error.message : "Failed to process scheduled items.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
