import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookies, setActiveWorkspaceCookie } from "@/lib/auth/cookies";
import { createAnonClient, createServerClient } from "@/lib/supabase/server";
import { getWorkspaceSettings, listUserWorkspaces, publicWorkspaceSettings } from "@/lib/workspaces";
import { acceptWorkspaceInvitation } from "@/lib/workspaces/invitations";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  inviteToken: z.string().min(10).optional(),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
    }

    const { email, password, inviteToken } = parsed.data;
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Invalid email or password." },
        { status: 401 }
      );
    }

    let joinedViaInvite = false;
    let preferredWorkspaceId = null;

    if (inviteToken) {
      try {
        const accepted = await acceptWorkspaceInvitation({
          token: inviteToken,
          userId: data.user.id,
          userEmail: data.user.email || email,
        });
        preferredWorkspaceId = accepted.workspaceId;
        joinedViaInvite = true;
      } catch (inviteError) {
        return NextResponse.json(
          {
            error:
              inviteError instanceof Error
                ? inviteError.message
                : "Could not accept the invitation.",
          },
          { status: 400 }
        );
      }
    }

    const userClient = createServerClient(data.session.access_token);
    const workspaces = await listUserWorkspaces(userClient, data.user.id);
    const workspace =
      workspaces.find((item) => item.id === preferredWorkspaceId) || workspaces[0] || null;

    let settings = null;
    if (workspace) {
      try {
        settings = publicWorkspaceSettings(
          await getWorkspaceSettings(userClient, workspace.id)
        );
      } catch {
        settings = null;
      }
    }

    const needsOnboarding =
      !joinedViaInvite &&
      (!workspace ||
        (workspace.role === "owner" &&
          (!workspace.onboarding_completed || !settings?.smtpConfigured)));

    const response = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      workspaces,
      workspace,
      joinedViaInvite,
      needsOnboarding,
    });

    setAuthCookies(response, data.session);
    if (workspace?.id) {
      setActiveWorkspaceCookie(response, workspace.id);
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
