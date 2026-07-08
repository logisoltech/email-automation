import { cookies } from "next/headers";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { createServerClient } from "@/lib/supabase/server";

/**
 * @returns {Promise<{ user: { id: string; email: string }; supabase: import("@supabase/supabase-js").SupabaseClient; accessToken: string } | null>}
 */
export async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.id || !data.user.email || !isEmailAllowed(data.user.email)) {
    return null;
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    supabase,
    accessToken,
  };
}
