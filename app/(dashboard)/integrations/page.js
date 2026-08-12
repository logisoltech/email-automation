"use client";

import { useEffect, useState } from "react";
import { Plug2 } from "lucide-react";
import { HubspotIntegrationCard } from "@/components/integrations/hubspot-integration-card";
import { ZohoIntegrationCard } from "@/components/integrations/zoho-integration-card";
import { SalesforceIntegrationCard } from "@/components/integrations/salesforce-integration-card";
import { Alert } from "@/components/ui/alert";

export default function IntegrationsPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teamRes, sessionRes] = await Promise.all([
          fetch("/api/workspaces/invitations"),
          fetch("/api/workspaces/settings"),
        ]);

        if (teamRes.ok) {
          const teamJson = await teamRes.json();
          if (!cancelled) setIsOwner(Boolean(teamJson.isOwner));
        } else if (sessionRes.ok) {
          const wsJson = await sessionRes.json();
          if (!cancelled) setIsOwner(wsJson.workspace?.role === "owner");
        } else {
          const authRes = await fetch("/api/auth/session");
          if (authRes.ok) {
            const authJson = await authRes.json();
            if (!cancelled) setIsOwner(authJson.workspace?.role === "owner");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-(--ink)/10 bg-(--ink) px-6 py-8 text-(--on-ink) sm:px-8 sm:py-10">
        <div className="ps-streaks pointer-events-none absolute inset-0 opacity-70" />
        <div className="ps-gloss pointer-events-none absolute inset-0" />
        <div className="relative max-w-xl">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-(--on-ink)/10 ring-1 ring-(--on-ink)/15">
            <Plug2 className="h-5 w-5 text-(--on-ink)" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-(--on-ink) sm:text-4xl">
            Integrations
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-(--on-ink)/65 sm:text-base">
            Wire your CRM once. Import contacts into Leads, then keep outreach
            status in sync when emails send or open.
          </p>
        </div>
      </section>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-(--muted-text)">
            CRM providers
          </h2>
          <p className="mt-1 text-sm font-light text-(--body)">
            Connect the tools your pipeline already lives in.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            <div className="h-48 animate-pulse rounded-2xl bg-(--ink)/6" />
            <div className="h-48 animate-pulse rounded-2xl bg-(--ink)/6" />
            <div className="h-48 animate-pulse rounded-2xl bg-(--ink)/6" />
          </div>
        ) : (
          <div className="grid gap-4">
            <HubspotIntegrationCard isOwner={isOwner} />
            <ZohoIntegrationCard isOwner={isOwner} />
            <SalesforceIntegrationCard isOwner={isOwner} />
          </div>
        )}
      </section>
    </div>
  );
}
