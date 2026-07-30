import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getWorkspaceSettings, publicWorkspaceSettings } from "@/lib/workspaces";

export async function GET() {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const settings = await getWorkspaceSettings(session.supabase, session.workspace.id);
  return NextResponse.json({
    workspace: session.workspace,
    settings: publicWorkspaceSettings(settings),
  });
}

const updateSchema = z.object({
  fromName: z.string().max(120).optional(),
  fromEmail: z.string().email().optional().or(z.literal("")),
  signatureText: z.string().max(4000).optional(),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional().nullable(),
  smtpPass: z.string().max(500).optional().nullable(),
  smtpTlsRejectUnauthorized: z.boolean().optional(),
  workspaceName: z.string().min(1).max(120).optional(),
  completeOnboarding: z.boolean().optional(),
});

export async function PUT(request) {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const existing = await getWorkspaceSettings(session.supabase, session.workspace.id);

  if (data.workspaceName) {
    const { error: nameError } = await session.supabase
      .from("workspaces")
      .update({ name: data.workspaceName.trim(), updated_at: new Date().toISOString() })
      .eq("id", session.workspace.id);

    if (nameError) {
      return NextResponse.json({ error: nameError.message }, { status: 500 });
    }
  }

  const signatureText =
    data.signatureText !== undefined ? data.signatureText : existing?.signature_text || "";
  const signatureHtml = signatureText
    ? `<p style="margin: 16px 0 0 0; line-height: 1.6;">${signatureText
        .split("\n")
        .map((line) =>
          line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        )
        .join("<br>")}</p>`
    : "";

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (data.fromName !== undefined) updatePayload.from_name = data.fromName;
  if (data.fromEmail !== undefined) updatePayload.from_email = data.fromEmail;
  if (data.signatureText !== undefined) {
    updatePayload.signature_text = signatureText;
    updatePayload.signature_html = signatureHtml;
  }
  if (data.smtpHost !== undefined) updatePayload.smtp_host = data.smtpHost;
  if (data.smtpPort !== undefined) updatePayload.smtp_port = data.smtpPort;
  if (data.smtpSecure !== undefined) updatePayload.smtp_secure = data.smtpSecure;
  if (data.smtpUser !== undefined) updatePayload.smtp_user = data.smtpUser;
  if (data.smtpTlsRejectUnauthorized !== undefined) {
    updatePayload.smtp_tls_reject_unauthorized = data.smtpTlsRejectUnauthorized;
  }
  if (data.smtpPass) {
    updatePayload.smtp_pass_encrypted = encryptSecret(data.smtpPass);
  }

  const smtpChanged =
    (data.smtpHost !== undefined && data.smtpHost !== existing?.smtp_host) ||
    (data.smtpPort !== undefined && data.smtpPort !== existing?.smtp_port) ||
    (data.smtpSecure !== undefined && data.smtpSecure !== existing?.smtp_secure) ||
    (data.smtpUser !== undefined && data.smtpUser !== existing?.smtp_user) ||
    (data.smtpTlsRejectUnauthorized !== undefined &&
      data.smtpTlsRejectUnauthorized !== existing?.smtp_tls_reject_unauthorized) ||
    Boolean(data.smtpPass);

  if (smtpChanged) {
    updatePayload.smtp_last_tested_at = null;
    updatePayload.smtp_last_error = null;
  }

  const host = data.smtpHost !== undefined ? data.smtpHost : existing?.smtp_host;
  const user = data.smtpUser !== undefined ? data.smtpUser : existing?.smtp_user;
  const hasPass = Boolean(data.smtpPass || existing?.smtp_pass_encrypted);
  updatePayload.smtp_configured = Boolean(host && user && hasPass);

  const { data: settings, error: settingsError } = await session.supabase
    .from("workspace_settings")
    .update(updatePayload)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  if (data.completeOnboarding) {
    if (!updatePayload.smtp_configured && !settings.smtp_configured) {
      return NextResponse.json(
        { error: "Configure SMTP before completing onboarding." },
        { status: 400 }
      );
    }
    if (!settings.smtp_last_tested_at) {
      return NextResponse.json(
        { error: "Send a successful SMTP test before completing onboarding." },
        { status: 400 }
      );
    }

    await session.supabase
      .from("workspaces")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", session.workspace.id);
  }

  return NextResponse.json({
    settings: publicWorkspaceSettings(settings),
  });
}
