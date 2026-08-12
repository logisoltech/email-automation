import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { buildAuthorizeUrl, isHubspotConfigured } from "@/lib/integrations/hubspot";

/**
 * Start HubSpot OAuth (owners only).
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  if (!isHubspotConfigured()) {
    return NextResponse.json(
      { error: "HubSpot is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const { url } = buildAuthorizeUrl(session.workspace.id);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start HubSpot connect." },
      { status: 500 }
    );
  }
}
