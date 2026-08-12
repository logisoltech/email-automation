import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/auth/cookies";
import { createServerClient } from "@/lib/supabase/server";

const publicPaths = ["/login", "/signup", "/invite"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/emails/process-scheduled") ||
    // Open-tracking pixel (opaque UUID; no auth)
    pathname.startsWith("/api/t/o/") ||
    pathname === "/favicon.ico" ||
    // Public invite preview (token query required)
    (pathname === "/api/workspaces/invitations" &&
      request.method === "GET" &&
      request.nextUrl.searchParams.has("token"))
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!accessToken) {
    if (isPublicPath) {
      return NextResponse.next();
    }

    // API routes should return JSON, not HTML login redirects
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = createServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      const response = isPublicPath
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/login", request.url));

      clearAuthCookies(response);
      return response;
    }

    if (isPublicPath && !pathname.startsWith("/invite")) {
      // Allow authenticated users to continue incomplete setup on /signup
      if (pathname === "/signup" || pathname.startsWith("/signup/")) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
      return NextResponse.redirect(new URL("/signup?setup=1", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response);
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
