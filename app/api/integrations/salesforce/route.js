import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  getSalesforceIntegration,
  isSalesforceConfigured,
} from "@/lib/integrations/salesforce";

/**
 * GET Salesforce connection status.
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const configured = isSalesforceConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      integration: null,
    });
  }

  const integration = await getSalesforceIntegration(
    session.supabase,
    session.workspace.id
  );

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
 * DELETE disconnect Salesforce.
 */
export async function DELETE() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  const { error: deleteError } = await session.supabase
    .from("workspace_integrations")
    .delete()
    .eq("workspace_id", session.workspace.id)
    .eq("provider", "salesforce");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
