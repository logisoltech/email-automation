import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { setActiveWorkspaceCookie } from "@/lib/auth/cookies";
import {
  createWorkspaceWithOwner,
  getWorkspaceSettings,
  publicWorkspaceSettings,
} from "@/lib/workspaces";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    workspaces: session.workspaces,
    activeWorkspaceId: session.workspace?.id ?? null,
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional().or(z.literal("")),
});

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const workspace = await createWorkspaceWithOwner(session.supabase, {
      name: parsed.data.name,
      userId: session.user.id,
      fromName: parsed.data.fromName || parsed.data.name,
      fromEmail: parsed.data.fromEmail || session.user.email,
    });

    const response = NextResponse.json({ workspace: { ...workspace, role: "owner" } });
    setActiveWorkspaceCookie(response, workspace.id);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create workspace." },
      { status: 500 }
    );
  }
}

/**
 * Switch active workspace
 */
export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const workspaceId = body.workspaceId;

  if (!workspaceId || typeof workspaceId !== "string") {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const match = session.workspaces.find((item) => item.id === workspaceId);
  if (!match) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const settings = publicWorkspaceSettings(
    await getWorkspaceSettings(session.supabase, workspaceId)
  );

  const response = NextResponse.json({ workspace: match, settings });
  setActiveWorkspaceCookie(response, workspaceId);
  return response;
}
