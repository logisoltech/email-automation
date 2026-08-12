import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { seedStarterTemplates } from "@/lib/templates";

/**
 * @param {string} name
 */
export function slugifyWorkspaceName(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "workspace";
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} name
 */
export async function createUniqueSlug(supabase, name) {
  const base = slugifyWorkspaceName(name);
  let slug = base;
  let attempt = 0;

  while (attempt < 20) {
    const { data } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    attempt += 1;
    slug = `${base}-${attempt + 1}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 */
export async function listUserWorkspaces(supabase, userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "role, created_at, workspace:workspaces(id, name, slug, onboarding_completed, plan, sends_per_hour, created_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.workspace)
    .map((row) => ({
      ...row.workspace,
      role: row.role,
    }));
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {string} userId
 */
export async function getMembership(supabase, workspaceId, userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 */
export async function getWorkspaceSettings(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{
 *   name: string;
 *   userId: string;
 *   fromName?: string;
 *   fromEmail?: string;
 * }} params
 */
export async function createWorkspaceWithOwner(supabase, params) {
  const slug = await createUniqueSlug(supabase, params.name);

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name: params.name.trim(),
      slug,
      created_by: params.userId,
      onboarding_completed: false,
    })
    .select("*")
    .single();

  if (workspaceError) throw new Error(workspaceError.message);

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: params.userId,
    role: "owner",
  });

  if (memberError) {
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    throw new Error(memberError.message);
  }

  const { error: settingsError } = await supabase.from("workspace_settings").insert({
    workspace_id: workspace.id,
    from_name: params.fromName?.trim() || params.name.trim(),
    from_email: params.fromEmail?.trim() || "",
  });

  if (settingsError) {
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    throw new Error(settingsError.message);
  }

  try {
    await seedStarterTemplates(supabase, workspace.id, params.userId);
  } catch {
    // Non-fatal: GET /api/templates will seed on first visit if this fails.
  }

  return workspace;
}

/**
 * Read active workspace cookie (server).
 */
export async function getActiveWorkspaceIdFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

/**
 * Public settings payload (never includes decrypted password).
 * @param {Record<string, unknown> | null} settings
 */
export function publicWorkspaceSettings(settings) {
  if (!settings) {
    return {
      fromName: "",
      fromEmail: "",
      signatureText: "",
      signatureImageUrl: null,
      sendingMode: null,
      sendingDomain: null,
      domainVerifiedAt: null,
      sesIdentity: null,
      smtpConfigured: false,
      smtpHost: null,
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: null,
      smtpHasPassword: false,
      smtpTlsRejectUnauthorized: true,
      smtpLastTestedAt: null,
      smtpLastError: null,
    };
  }

  return {
    fromName: settings.from_name || "",
    fromEmail: settings.from_email || "",
    signatureText: settings.signature_text || "",
    signatureImageUrl: settings.signature_image_url || null,
    sendingMode: settings.sending_mode || null,
    sendingDomain: settings.sending_domain || null,
    domainVerifiedAt: settings.domain_verified_at || null,
    sesIdentity: settings.ses_identity || null,
    smtpConfigured: Boolean(settings.smtp_configured),
    smtpHost: settings.smtp_host || null,
    smtpPort: settings.smtp_port || 587,
    smtpSecure: Boolean(settings.smtp_secure),
    smtpUser: settings.smtp_user || null,
    smtpHasPassword: Boolean(settings.smtp_pass_encrypted),
    smtpTlsRejectUnauthorized: settings.smtp_tls_reject_unauthorized !== false,
    smtpLastTestedAt: settings.smtp_last_tested_at || null,
    smtpLastError: settings.smtp_last_error || null,
  };
}
