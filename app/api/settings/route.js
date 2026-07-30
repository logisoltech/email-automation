import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { getSettingsStatus } from "@/lib/settings/config";
import { getWorkspaceSettings, publicWorkspaceSettings } from "@/lib/workspaces";

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceSettings = await getWorkspaceSettings(
    session.supabase,
    session.workspace.id
  );

  return NextResponse.json({
    user: session.user,
    workspace: session.workspace,
    workspaceSettings: publicWorkspaceSettings(workspaceSettings),
    settings: getSettingsStatus(workspaceSettings),
  });
}
