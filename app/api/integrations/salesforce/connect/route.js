import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  SF_PKCE_COOKIE,
  buildAuthorizeUrl,
  createPkcePair,
  isSalesforceConfigured,
} from "@/lib/integrations/salesforce";

/**
 * Start Salesforce OAuth (owners only). Uses PKCE (required by External Client Apps).
 */
export async function GET() {
  const { session, error } = await requireWorkspaceSession({ requireOwner: true });
  if (error) return error;

  if (!isSalesforceConfigured()) {
    return NextResponse.json(
      { error: "Salesforce is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const { verifier, challenge } = createPkcePair();
    const { url } = buildAuthorizeUrl(session.workspace.id, {
      codeChallenge: challenge,
    });
    const res = NextResponse.redirect(url);
    res.cookies.set(SF_PKCE_COOKIE, verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to start Salesforce connect.",
      },
      { status: 500 }
    );
  }
}
