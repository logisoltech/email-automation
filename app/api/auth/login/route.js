import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { setAuthCookies } from "@/lib/auth/cookies";
import { createAnonClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
    }

    const { email, password } = parsed.data;

    if (!isEmailAllowed(email)) {
      return NextResponse.json(
        { error: "Access denied. Only @logisol.tech accounts are allowed." },
        { status: 403 }
      );
    }

    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message ?? "Invalid email or password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });

    setAuthCookies(response, data.session);
    return response;
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
