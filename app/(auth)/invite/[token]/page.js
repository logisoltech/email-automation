"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      fetch("/api/auth/session").then((res) => res.ok),
      fetch(`/api/workspaces/invitations?token=${encodeURIComponent(token)}`).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invitation not found.");
        return data.invitation;
      }),
    ])
      .then(([isAuthed, invitation]) => {
        setAuthenticated(isAuthed);
        setPreview(invitation);
      })
      .catch((err) => {
        setError(err.message || "Could not load invitation.");
      })
      .finally(() => setLoadingPreview(false));
  }, [token]);

  async function acceptInvite() {
    setError("");
    setLoading(true);
    try {
      if (!authenticated) {
        router.push(`/signup?invite=${encodeURIComponent(token)}`);
        return;
      }

      const res = await fetch("/api/workspaces/invitations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invitation.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inviteSignupHref = `/signup?invite=${encodeURIComponent(token)}`;
  const inviteLoginHref = `/login?invite=${encodeURIComponent(token)}&next=/`;

  return (
    <div className="flex min-h-screen items-center justify-center ps-page px-4">
      <Card className="w-full max-w-md space-y-5" title="Workspace invitation">
        {loadingPreview ? (
          <p className="text-sm text-(--muted-text)">Loading invitation…</p>
        ) : preview ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--ink) text-(--on-ink)">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-(--body)">
                  You&apos;ve been invited to join{" "}
                  <span className="font-semibold text-(--heading)">{preview.workspaceName}</span>
                  {" "}as a {preview.role}.
                </p>
                <p className="mt-1 text-xs text-(--muted-text)">
                  Use the email <span className="font-medium">{preview.email}</span> to accept.
                </p>
              </div>
            </div>

            {preview.expired ? (
              <Alert variant="error">This invitation is no longer valid.</Alert>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-(--body)">
            You&apos;ve been invited to join a workspace on OutreachOS.
          </p>
        )}

        {error ? <Alert variant="error">{error}</Alert> : null}

        {!preview?.expired ? (
          authenticated ? (
            <Button onClick={acceptInvite} loading={loading} className="w-full">
              Accept invitation
            </Button>
          ) : (
            <div className="space-y-3">
              <Button onClick={acceptInvite} loading={loading} className="w-full">
                Create account & join
              </Button>
              <p className="text-center text-sm text-(--muted-text)">
                Already have an account?{" "}
                <Link
                  href={inviteLoginHref}
                  className="font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 hover:decoration-(--ink)"
                >
                  Sign in
                </Link>
              </p>
              <p className="text-center text-xs text-(--muted-text)">
                Or{" "}
                <Link
                  href={inviteSignupHref}
                  className="font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 hover:decoration-(--ink)"
                >
                  sign up with this invite
                </Link>
              </p>
            </div>
          )
        ) : null}
      </Card>
    </div>
  );
}
