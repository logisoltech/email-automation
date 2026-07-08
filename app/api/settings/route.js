import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getSettingsStatus } from "@/lib/settings/config";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    user: session.user,
    settings: getSettingsStatus(),
  });
}
