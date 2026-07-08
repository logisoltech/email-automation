import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/auth/cookies";
import { createServerClient } from "@/lib/supabase/server";

const publicPaths = ["/login"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/emails/process-scheduled") ||
    pathname === "/favicon.ico"
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

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = createServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.email || !isEmailAllowed(data.user.email)) {
      const response = isPublicPath
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/login", request.url));

      clearAuthCookies(response);
      return response;
    }

    if (isPublicPath) {
      return NextResponse.redirect(new URL("/", request.url));
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
