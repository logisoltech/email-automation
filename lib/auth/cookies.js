export const ACCESS_TOKEN_COOKIE = "sb-access-token";
export const REFRESH_TOKEN_COOKIE = "sb-refresh-token";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

/**
 * @param {import("next/server").NextResponse} response
 * @param {{ access_token: string; refresh_token: string; expires_in?: number }} session
 */
export function setAuthCookies(response, session) {
  const maxAge = session.expires_in ?? 60 * 60;

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * @param {import("next/server").NextResponse} response
 */
export function clearAuthCookies(response) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
