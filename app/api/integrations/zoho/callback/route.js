import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  OUTREACH_STATUS_FIELD,
  encryptTokenRow,
  ensureOutreachStatusField,
  exchangeCodeForTokens,
  fetchOrgInfo,
  getZohoIntegration,
  isZohoConfigured,
  parseOAuthState,
  resolveZohoDomains,
} from "@/lib/integrations/zoho";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth callback from Zoho.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const location = searchParams.get("location");
  const accountsServer = searchParams.get("accounts-server");

  const integrationsUrl = new URL("/integrations", request.url);

  if (oauthError) {
    integrationsUrl.searchParams.set("zoho_error", oauthError);
    return NextResponse.redirect(integrationsUrl);
  }

  if (!code || !state) {
    integrationsUrl.searchParams.set("zoho_error", "missing_code");
    return NextResponse.redirect(integrationsUrl);
  }

  if (!isZohoConfigured()) {
    integrationsUrl.searchParams.set("zoho_error", "not_configured");
    return NextResponse.redirect(integrationsUrl);
  }

  const workspaceId = parseOAuthState(state);
  if (!workspaceId) {
    integrationsUrl.searchParams.set("zoho_error", "invalid_state");
    return NextResponse.redirect(integrationsUrl);
  }

  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) {
    return NextResponse.redirect(new URL("/login?next=/integrations", request.url));
  }

  if (session.workspace.id !== workspaceId) {
    integrationsUrl.searchParams.set("zoho_error", "workspace_mismatch");
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    const domains = resolveZohoDomains(location);
    const accountsUrl = (accountsServer || domains.accountsUrl).replace(/\/$/, "");
    const tokens = await exchangeCodeForTokens(code, { accountsUrl });
    const encrypted = encryptTokenRow(tokens);
    const accessToken = tokens.access_token;
    const apiDomain = String(tokens.api_domain || domains.apiDomain).replace(/\/$/, "");

    let hubId = null;
    let accountName = null;
    try {
      const org = await fetchOrgInfo(accessToken, apiDomain);
      hubId = org.hubId;
      accountName = org.accountName;
    } catch {
      // optional
    }

    try {
      await ensureOutreachStatusField(accessToken, apiDomain);
    } catch (propErr) {
      console.error("[zoho] ensureOutreachStatusField", propErr);
    }

    const admin = createAdminClient();
    const existing = await getZohoIntegration(admin, workspaceId);

    const row = {
      workspace_id: workspaceId,
      provider: "zoho",
      status: "connected",
      ...encrypted,
      hub_id: hubId,
      account_name: accountName,
      last_error: null,
      connected_at: new Date().toISOString(),
      connected_by: session.user.id,
      updated_at: new Date().toISOString(),
      config: {
        statusField: OUTREACH_STATUS_FIELD,
        apiDomain,
        accountsUrl,
        location: location || "us",
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

    integrationsUrl.searchParams.set("zoho", "connected");
    return NextResponse.redirect(integrationsUrl);
  } catch (err) {
    integrationsUrl.searchParams.set(
      "zoho_error",
      err instanceof Error ? err.message : "connect_failed"
    );
    return NextResponse.redirect(integrationsUrl);
  }
}
