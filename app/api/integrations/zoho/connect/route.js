import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { buildAuthorizeUrl, isZohoConfigured } from "@/lib/integrations/zoho";

/**
 * Start Zoho OAuth (owners only).
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  if (!isZohoConfigured()) {
    return NextResponse.json(
      { error: "Zoho is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const { url } = buildAuthorizeUrl(session.workspace.id);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start Zoho connect." },
      { status: 500 }
    );
  }
}
