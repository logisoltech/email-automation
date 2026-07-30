import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { createServerClient } from "@/lib/supabase/server";
import { getMembership, listUserWorkspaces } from "@/lib/workspaces";

/**
 * @returns {Promise<{
 *   user: { id: string; email: string };
 *   supabase: import("@supabase/supabase-js").SupabaseClient;
 *   accessToken: string;
 *   workspaces: Array<{ id: string; name: string; slug: string; role: string; onboarding_completed: boolean; plan: string; sends_per_hour: number }>;
 *   workspace: { id: string; name: string; slug: string; role: string; onboarding_completed: boolean; plan: string; sends_per_hour: number } | null;
 * } | null>}
 */
export async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.id || !data.user.email) {
    return null;
  }

  const workspaces = await listUserWorkspaces(supabase, data.user.id);
  const preferredId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const workspace =
    workspaces.find((item) => item.id === preferredId) || workspaces[0] || null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    supabase,
    accessToken,
    workspaces,
    workspace,
  };
}

/**
 * Require an authenticated session with an active workspace membership.
 * @param {{ requireOnboardingComplete?: boolean; requireOwner?: boolean }} [options]
 */
export async function requireWorkspaceSession(options = {}) {
  const session = await getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  if (!session.workspace) {
    return {
      error: NextResponse.json(
        { error: "No workspace found. Complete onboarding first." },
        { status: 403 }
      ),
      session,
    };
  }

  if (options.requireOwner && session.workspace.role !== "owner") {
    return {
      error: NextResponse.json({ error: "Owner access required." }, { status: 403 }),
      session,
    };
  }

  if (options.requireOnboardingComplete && !session.workspace.onboarding_completed) {
    return {
      error: NextResponse.json(
        { error: "Complete onboarding before using this feature." },
        { status: 403 }
      ),
      session,
    };
  }

  const membership = await getMembership(
    session.supabase,
    session.workspace.id,
    session.user.id
  );

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Not a member of this workspace." },
        { status: 403 }
      ),
      session,
    };
  }

  return { session };
}
