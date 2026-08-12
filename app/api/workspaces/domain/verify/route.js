import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { formatSesError, isSesConfigured, refreshSesDomain } from "@/lib/email/ses";
import { getWorkspaceSettings, publicWorkspaceSettings } from "@/lib/workspaces";

/**
 * Re-check Amazon SES domain verification after the user adds DNS records.
 */
export async function POST() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  if (!isSesConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform sending is not available (set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).",
      },
      { status: 503 }
    );
  }

  const existing = await getWorkspaceSettings(session.supabase, session.workspace.id);
  const identity = existing?.ses_identity || existing?.sending_domain;
  if (!identity) {
    return NextResponse.json({ error: "Register a domain first." }, { status: 400 });
  }

  let domain;
  try {
    domain = await refreshSesDomain(identity);
  } catch (err) {
    return NextResponse.json({ error: formatSesError(err) }, { status: 502 });
  }

  const { data: settings, error: updateError } = await session.supabase
    .from("workspace_settings")
    .update({
      sending_mode: "platform",
      ses_identity: domain.name,
      sending_domain: domain.name,
      domain_verified_at: domain.verified
        ? existing.domain_verified_at || new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    verified: domain.verified,
    status: domain.status,
    records: domain.records,
    settings: publicWorkspaceSettings(settings),
    message: domain.verified
      ? "Domain verified in Amazon SES. You can finish onboarding."
      : "DNS not verified yet. Add the CNAME records below, wait a few minutes, then try again.",
  });
}
