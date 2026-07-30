import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accept a pending workspace invitation for an authenticated user.
 * @param {{
 *   token: string;
 *   userId: string;
 *   userEmail: string;
 * }} params
 */
export async function acceptWorkspaceInvitation({ token, userId, userEmail }) {
  const admin = createAdminClient();

  const { data: invitation, error: inviteError } = await admin
    .from("workspace_invitations")
    .select("*, workspace:workspaces(id, name, onboarding_completed)")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  if (!invitation) {
    throw new Error("Invitation not found or already used.");
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await admin
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    throw new Error("Invitation has expired.");
  }

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error(
      `This invite was sent to ${invitation.email}. Sign in with that email to accept.`
    );
  }

  const { error: memberError } = await admin.from("workspace_members").upsert(
    {
      workspace_id: invitation.workspace_id,
      user_id: userId,
      role: invitation.role,
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (memberError) {
    throw new Error(memberError.message);
  }

  await admin
    .from("workspace_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);

  return {
    workspaceId: invitation.workspace_id,
    role: invitation.role,
    workspaceName: invitation.workspace?.name || "Workspace",
    email: invitation.email,
  };
}

/**
 * Public invite preview (no auth required).
 * @param {string} token
 */
export async function getInvitationPreview(token) {
  const admin = createAdminClient();

  const { data: invitation, error } = await admin
    .from("workspace_invitations")
    .select("email, role, status, expires_at, workspace:workspaces(id, name)")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!invitation) {
    return null;
  }

  const expired =
    invitation.status !== "pending" ||
    new Date(invitation.expires_at).getTime() < Date.now();

  return {
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expired,
    workspaceName: invitation.workspace?.name || "a workspace",
  };
}
