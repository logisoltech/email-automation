import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  ensureSesDomain,
  formatSesError,
  getSesDomain,
  isSesConfigured,
  isValidDomainName,
} from "@/lib/email/ses";
import { getWorkspaceSettings, publicWorkspaceSettings } from "@/lib/workspaces";

/**
 * GET current platform domain + DNS records (from Amazon SES when registered).
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession();
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

  const settings = await getWorkspaceSettings(session.supabase, session.workspace.id);
  let records = [];
  let status = null;
  const identity = settings?.ses_identity || settings?.sending_domain;

  if (identity) {
    try {
      const domain = await getSesDomain(identity);
      records = domain.records;
      status = domain.status;

      if (domain.verified && !settings.domain_verified_at) {
        await session.supabase
          .from("workspace_settings")
          .update({
            domain_verified_at: new Date().toISOString(),
            sending_mode: "platform",
            ses_identity: domain.name,
            sending_domain: domain.name,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", session.workspace.id);
      }
    } catch (err) {
      return NextResponse.json({ error: formatSesError(err) }, { status: 502 });
    }
  }

  const refreshed = await getWorkspaceSettings(session.supabase, session.workspace.id);

  return NextResponse.json({
    settings: publicWorkspaceSettings(refreshed),
    domain: refreshed?.sending_domain || refreshed?.ses_identity || null,
    status,
    records,
    platformAvailable: true,
  });
}

const createSchema = z.object({
  domain: z.string().min(3).max(253),
});

/**
 * Register domain with Amazon SES and store on workspace settings.
 */
export async function POST(request) {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  if (!isSesConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform sending is not available. Ask the admin to configure Amazon SES credentials.",
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid domain." }, { status: 400 });
  }

  const domainName = parsed.data.domain.trim().toLowerCase();
  if (!isValidDomainName(domainName)) {
    return NextResponse.json(
      { error: "Enter a valid domain like company.com (no http://)." },
      { status: 400 }
    );
  }

  let domainPayload;
  try {
    domainPayload = await ensureSesDomain(domainName);
  } catch (err) {
    return NextResponse.json({ error: formatSesError(err) }, { status: 502 });
  }

  const { data: settings, error: updateError } = await session.supabase
    .from("workspace_settings")
    .update({
      sending_mode: "platform",
      sending_domain: domainName,
      ses_identity: domainName,
      resend_domain_id: null,
      domain_verified_at: domainPayload.verified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: publicWorkspaceSettings(settings),
    domain: domainName,
    status: domainPayload.status,
    records: domainPayload.records,
  });
}
