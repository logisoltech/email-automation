"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

function inviteTokenFromParams(searchParams) {
  const invite = searchParams.get("invite");
  if (invite) return invite;
  const next = searchParams.get("next") || "";
  const match = next.match(/^\/invite\/([^/?#]+)/);
  return match?.[1] || "";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const inviteToken = inviteTokenFromParams(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");

      if (data.joinedViaInvite) {
        router.push("/");
      } else if (data.needsOnboarding) {
        router.push("/signup?setup=1");
      } else {
        const destination =
          next.startsWith("/") && !next.startsWith("/invite/") ? next : "/";
        router.push(destination);
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const signupHref = inviteToken
    ? `/signup?invite=${encodeURIComponent(inviteToken)}`
    : "/signup";

  return (
    <div className="flex min-h-screen ps-page">
      <AuthBrandPanel
        title="Personalized outreach, without the busywork."
        description="Connect your SMTP, import leads, generate tailored emails with AI, and send at a controlled pace — all from one workspace."
        footer="Built for sales and agency teams"
      />

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--muted-text)">
              Sign in
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-(--heading)">
              Welcome back
            </h2>
            <p className="mt-2 text-sm font-light text-(--muted-text)">
              {inviteToken
                ? "Sign in with the invited email to join the workspace."
                : "Sign in to your workspace."}{" "}
              New here?{" "}
              <Link
                href={signupHref}
                className="font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 hover:decoration-(--ink)"
              >
                Create an account
              </Link>
            </p>
          </div>

          {inviteToken ? (
            <Alert variant="info">You&apos;re accepting a workspace invitation.</Alert>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              {inviteToken ? "Sign in & join workspace" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
