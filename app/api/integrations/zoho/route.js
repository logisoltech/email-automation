import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getZohoIntegration, isZohoConfigured } from "@/lib/integrations/zoho";

/**
 * GET Zoho connection status for the active workspace.
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const configured = isZohoConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      integration: null,
    });
  }

  const integration = await getZohoIntegration(session.supabase, session.workspace.id);

  return NextResponse.json({
    configured: true,
    connected: integration?.status === "connected",
    integration: integration
      ? {
          status: integration.status,
          hubId: integration.hub_id,
          accountName: integration.account_name,
          connectedAt: integration.connected_at,
          lastSyncAt: integration.last_sync_at,
          lastError: integration.last_error,
        }
      : null,
  });
}

/**
 * DELETE disconnect Zoho.
 */
export async function DELETE() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  const { error: deleteError } = await session.supabase
    .from("workspace_integrations")
    .delete()
    .eq("workspace_id", session.workspace.id)
    .eq("provider", "zoho");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
