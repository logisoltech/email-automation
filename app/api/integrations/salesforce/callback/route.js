import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  OUTREACH_STATUS_FIELD,
  SF_PKCE_COOKIE,
  encryptTokenRow,
  ensureOutreachStatusField,
  exchangeCodeForTokens,
  fetchOrgInfo,
  getSalesforceIntegration,
  getSalesforceLoginBase,
  isSalesforceConfigured,
  parseOAuthState,
} from "@/lib/integrations/salesforce";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth callback from Salesforce.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");

  const integrationsUrl = new URL("/integrations", request.url);

  if (oauthError) {
    integrationsUrl.searchParams.set(
      "salesforce_error",
      oauthErrorDesc || oauthError
    );
    return NextResponse.redirect(integrationsUrl);
  }

  if (!code || !state) {
    integrationsUrl.searchParams.set("salesforce_error", "missing_code");
    return NextResponse.redirect(integrationsUrl);
  }

  if (!isSalesforceConfigured()) {
    integrationsUrl.searchParams.set("salesforce_error", "not_configured");
    return NextResponse.redirect(integrationsUrl);
  }

  const workspaceId = parseOAuthState(state);
  if (!workspaceId) {
    integrationsUrl.searchParams.set("salesforce_error", "invalid_state");
    return NextResponse.redirect(integrationsUrl);
  }

  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) {
    return NextResponse.redirect(new URL("/login?next=/integrations", request.url));
  }

  if (session.workspace.id !== workspaceId) {
    integrationsUrl.searchParams.set("salesforce_error", "workspace_mismatch");
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    const codeVerifier = request.cookies.get(SF_PKCE_COOKIE)?.value;
    if (!codeVerifier) {
      integrationsUrl.searchParams.set(
        "salesforce_error",
        "missing_pkce_verifier"
      );
      return NextResponse.redirect(integrationsUrl);
    }

    const tokens = await exchangeCodeForTokens(code, { codeVerifier });
    const encrypted = encryptTokenRow(tokens);
    const accessToken = tokens.access_token;
    const instanceUrl = String(tokens.instance_url || "").replace(/\/$/, "");
    if (!instanceUrl) {
      throw new Error("Salesforce did not return an instance URL.");
    }

    let hubId = null;
    let accountName = null;
    try {
      const org = await fetchOrgInfo(accessToken, instanceUrl, tokens.id);
      hubId = org.hubId;
      accountName = org.accountName;
    } catch {
      // optional
    }

    try {
      await ensureOutreachStatusField(accessToken, instanceUrl);
    } catch (propErr) {
      console.error("[salesforce] ensureOutreachStatusField", propErr);
    }

    const admin = createAdminClient();
    const existing = await getSalesforceIntegration(admin, workspaceId);

    const row = {
      workspace_id: workspaceId,
      provider: "salesforce",
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
        instanceUrl,
        loginUrl: getSalesforceLoginBase(),
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

    integrationsUrl.searchParams.set("salesforce", "connected");
    const success = NextResponse.redirect(integrationsUrl);
    success.cookies.set(SF_PKCE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return success;
  } catch (err) {
    integrationsUrl.searchParams.set(
      "salesforce_error",
      err instanceof Error ? err.message : "connect_failed"
    );
    const fail = NextResponse.redirect(integrationsUrl);
    fail.cookies.set(SF_PKCE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return fail;
  }
}
