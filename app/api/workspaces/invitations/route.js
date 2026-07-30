import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSession, requireWorkspaceSession } from "@/lib/auth/get-session";
import { setActiveWorkspaceCookie } from "@/lib/auth/cookies";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acceptWorkspaceInvitation,
  getInvitationPreview,
} from "@/lib/workspaces/invitations";

async function enrichMembersWithEmail(members) {
  if (!members?.length) return [];

  const admin = createAdminClient();
  return Promise.all(
    members.map(async (member) => {
      try {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        return {
          id: member.id,
          role: member.role,
          userId: member.user_id,
          email: data.user?.email || null,
          createdAt: member.created_at,
        };
      } catch {
        return {
          id: member.id,
          role: member.role,
          userId: member.user_id,
          email: null,
          createdAt: member.created_at,
        };
      }
    })
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  // Public preview for invite landing page
  if (token) {
    try {
      const preview = await getInvitationPreview(token);
      if (!preview) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
      }
      return NextResponse.json({ invitation: preview });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to load invite." },
        { status: 500 }
      );
    }
  }

  // Any workspace member can view the roster; only owners invite
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const isOwner = session.workspace.role === "owner";

  const { data: members, error: membersError } = await session.supabase
    .from("workspace_members")
    .select("id, role, user_id, created_at")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: true });

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  let invitations = [];
  if (isOwner) {
    const { data, error: listError } = await session.supabase
      .from("workspace_invitations")
      .select("id, email, role, status, expires_at, created_at")
      .eq("workspace_id", session.workspace.id)
      .order("created_at", { ascending: false });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    invitations = data ?? [];
  }

  return NextResponse.json({
    isOwner,
    role: session.workspace.role,
    invitations,
    members: await enrichMembersWithEmail(members ?? []),
  });
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

export async function POST(request) {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const token = crypto.randomBytes(24).toString("hex");

  const { data, error: insertError } = await session.supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: session.workspace.id,
      email,
      role: parsed.data.role,
      token,
      invited_by: session.user.id,
      status: "pending",
    })
    .select("id, email, role, status, expires_at, created_at, token")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    invitation: data,
    inviteUrl: `/invite/${data.token}`,
  });
}

const acceptSchema = z.object({
  token: z.string().min(10),
});

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }

  try {
    const result = await acceptWorkspaceInvitation({
      token: parsed.data.token,
      userId: session.user.id,
      userEmail: session.user.email,
    });

    const response = NextResponse.json({
      success: true,
      workspaceId: result.workspaceId,
      workspaceName: result.workspaceName,
      role: result.role,
    });
    setActiveWorkspaceCookie(response, result.workspaceId);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to accept invite." },
      { status: 400 }
    );
  }
}
