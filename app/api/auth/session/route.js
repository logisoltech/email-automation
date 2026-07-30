import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getWorkspaceSettings, publicWorkspaceSettings } from "@/lib/workspaces";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let settings = null;
  if (session.workspace) {
    try {
      settings = publicWorkspaceSettings(
        await getWorkspaceSettings(session.supabase, session.workspace.id)
      );
    } catch {
      settings = null;
    }
  }

  const isOwner = session.workspace?.role === "owner";
  const needsOnboarding =
    !session.workspace ||
    (isOwner &&
      (!session.workspace.onboarding_completed || !settings?.smtpConfigured));

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    workspaces: session.workspaces,
    workspace: session.workspace,
    settings,
    needsOnboarding,
  });
}
