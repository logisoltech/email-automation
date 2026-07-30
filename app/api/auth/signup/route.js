import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookies, setActiveWorkspaceCookie } from "@/lib/auth/cookies";
import { createAnonClient, createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkspaceWithOwner, listUserWorkspaces } from "@/lib/workspaces";
import { acceptWorkspaceInvitation } from "@/lib/workspaces/invitations";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(1, "Name is required.").max(120),
  workspaceName: z.string().max(120).optional(),
  inviteToken: z.string().min(10).optional(),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const { email, password, fullName, workspaceName, inviteToken } = parsed.data;
    const joiningViaInvite = Boolean(inviteToken);

    if (!joiningViaInvite && !workspaceName?.trim()) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const supabase = createAnonClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Signup failed." }, { status: 500 });
    }

    let workspace = null;
    let role = "owner";
    let joinedViaInvite = false;

    if (joiningViaInvite) {
      try {
        const accepted = await acceptWorkspaceInvitation({
          token: inviteToken,
          userId: data.user.id,
          userEmail: data.user.email || email,
        });
        workspace = {
          id: accepted.workspaceId,
          name: accepted.workspaceName,
          role: accepted.role,
          onboarding_completed: true,
        };
        role = accepted.role;
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
    } else {
      const admin = createAdminClient();
      workspace = await createWorkspaceWithOwner(admin, {
        name: workspaceName.trim(),
        userId: data.user.id,
        fromName: fullName,
        fromEmail: email,
      });
      role = "owner";
    }

    if (!data.session) {
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: true,
        joinedViaInvite,
        message: joinedViaInvite
          ? "Check your email to confirm your account, then sign in to open the workspace."
          : "Check your email to confirm your account, then sign in.",
        workspace: { id: workspace.id, name: workspace.name, role },
      });
    }

    const userClient = createServerClient(data.session.access_token);
    const workspaces = await listUserWorkspaces(userClient, data.user.id).catch(() => [
      { ...workspace, role },
    ]);

    const active =
      workspaces.find((item) => item.id === workspace.id) ||
      workspaces[0] ||
      { ...workspace, role };

    const response = NextResponse.json({
      success: true,
      needsEmailConfirmation: false,
      joinedViaInvite,
      needsOnboarding: !joinedViaInvite && role === "owner",
      user: { id: data.user.id, email: data.user.email },
      workspace: active,
    });

    setAuthCookies(response, data.session);
    setActiveWorkspaceCookie(response, active.id);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
