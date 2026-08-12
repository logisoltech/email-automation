import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  ensureOutreachStatusProperty,
  encryptTokenRow,
  exchangeCodeForTokens,
  getHubspotIntegration,
  hubspotFetch,
  isHubspotConfigured,
  parseOAuthState,
} from "@/lib/integrations/hubspot";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth callback from HubSpot.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const settingsUrl = new URL("/integrations", request.url);

  if (oauthError) {
    settingsUrl.searchParams.set("hubspot_error", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("hubspot_error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  if (!isHubspotConfigured()) {
    settingsUrl.searchParams.set("hubspot_error", "not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const workspaceId = parseOAuthState(state);
  if (!workspaceId) {
    settingsUrl.searchParams.set("hubspot_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) {
    return NextResponse.redirect(new URL("/login?next=/integrations", request.url));
  }

  if (session.workspace.id !== workspaceId) {
    settingsUrl.searchParams.set("hubspot_error", "workspace_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const encrypted = encryptTokenRow(tokens);
    const accessToken = tokens.access_token;

    let hubId = tokens.hub_id ? String(tokens.hub_id) : null;
    let accountName = null;
    try {
      const info = await hubspotFetch(
        accessToken,
        `/oauth/v1/access-tokens/${accessToken}`
      );
      hubId = hubId || (info.hub_id != null ? String(info.hub_id) : null);
      accountName = info.hub_domain || info.user || null;
    } catch {
      // optional
    }

    try {
      await ensureOutreachStatusProperty(accessToken);
    } catch (propErr) {
      // Don't block connect — property can be created on first status push / after scopes update
      console.error("[hubspot] ensureOutreachStatusProperty", propErr);
    }

    const admin = createAdminClient();
    const existing = await getHubspotIntegration(admin, workspaceId);

    const row = {
      workspace_id: workspaceId,
      provider: "hubspot",
      status: "connected",
      ...encrypted,
      hub_id: hubId,
      account_name: accountName,
      last_error: null,
      connected_at: new Date().toISOString(),
      connected_by: session.user.id,
      updated_at: new Date().toISOString(),
      config: {
        statusProperty: "bulkly_outreach_status",
      },
    };

    if (existing?.id) {
      const { error: updateError } = await admin
        .from("workspace_integrations")
        .update(row)
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await admin.from("workspace_integrations").insert(row);
      if (insertError) throw new Error(insertError.message);
    }

    settingsUrl.searchParams.set("hubspot", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    settingsUrl.searchParams.set(
      "hubspot_error",
      err instanceof Error ? err.message : "connect_failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
