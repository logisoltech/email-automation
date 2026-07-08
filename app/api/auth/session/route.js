import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/auth/cookies";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const supabase = createServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    if (!isEmailAllowed(data.user.email)) {
      const response = NextResponse.json({ user: null }, { status: 403 });
      clearAuthCookies(response);
      return response;
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
