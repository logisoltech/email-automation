"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MailPlus,
  Clock,
  Megaphone,
  ArrowRight,
  ArrowUpRight,
  Users,
  Sparkles,
  Eye,
} from "lucide-react";
import { ActivationChecklist } from "@/components/dashboard/activation-checklist";
import { fetchJson, queryKeys } from "@/lib/query";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [dismissing, setDismissing] = useState(false);

  const statsQuery = useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => fetchJson("/api/analytics/stats"),
    staleTime: 60_000,
  });

  const sessionQuery = useQuery({
    queryKey: queryKeys.session(),
    queryFn: () => fetchJson("/api/auth/session"),
    staleTime: 60_000,
  });

  const activationQuery = useQuery({
    queryKey: queryKeys.activation(),
    queryFn: () => fetchJson("/api/activation"),
    staleTime: 60_000,
  });

  const stats = {
    sent: 0,
    opened: 0,
    openRate: 0,
    scheduled: 0,
    failed: 0,
    campaigns: 0,
    campaignSent: 0,
    ...(statsQuery.data?.stats || {}),
  };
  const workspaceName = sessionQuery.data?.workspace?.name || "";
  const activation = activationQuery.data?.activation || null;
  const loading = statsQuery.isLoading && !statsQuery.data;

  async function dismissActivation() {
    setDismissing(true);
    try {
      const res = await fetch("/api/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: true }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.activation() });
      }
    } finally {
      setDismissing(false);
    }
  }

  const cards = [
    {
      label: "Emails sent",
      value: stats.sent,
      icon: MailPlus,
      note: "All time",
      href: "/history",
    },
    {
      label: "Opened",
      value: stats.opened,
      icon: Eye,
      note: stats.sent > 0 ? `${stats.openRate}% open rate` : "No sends yet",
      href: "/history",
    },
    {
      label: "Scheduled",
      value: stats.scheduled,
      icon: Clock,
      note: "Waiting in queue",
      href: "/history",
    },
    {
      label: "Campaigns",
      value: stats.campaigns,
      icon: Megaphone,
      note: `${stats.campaignSent} sent`,
      href: "/campaigns",
    },
  ];

  const quickLinks = [
    {
      href: "/compose",
      title: "Personalized email",
      description: "Write with AI, then send or schedule it.",
      icon: Sparkles,
    },
    {
      href: "/leads",
      title: "Leads",
      description: "Import contacts and organize by subcategory.",
      icon: Users,
    },
    {
      href: "/campaigns?new=1",
      title: "New campaign",
      description: "Pick leads, generate personalized emails, send.",
      icon: Megaphone,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {activation?.visible ? (
        <ActivationChecklist
          activation={activation}
          onDismiss={dismissActivation}
          dismissing={dismissing}
        />
      ) : null}

      <section className="ps-panel-ink ps-streaks px-7 py-9 sm:px-10 sm:py-11">
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--on-ink)/45">
              {loading ? "Loading" : workspaceName || "Workspace"}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              <span className="ps-chrome-text">Outreach</span>
              <span className="text-(--on-ink)">, engineered.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-(--on-ink)/60">
              Import leads, let AI write every message, and send at a pace your mailbox can
              actually handle.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/compose"
                className="group inline-flex h-11 items-center gap-2 rounded-xl bg-(--on-ink) px-5 text-sm font-medium text-(--ink)! transition hover:bg-(--on-ink)/90"
              >
                Personalized email
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/leads"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-(--on-ink)/20 px-5 text-sm font-medium text-(--on-ink)/80 transition hover:border-(--on-ink)/40 hover:text-(--on-ink)"
              >
                Import leads
              </Link>
            </div>
          </div>

          <div className="shrink-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--on-ink)/40">
              Sent all time
            </p>
            <p className="ps-chrome-text mt-2 text-6xl font-semibold tracking-tighter tabular-nums sm:text-7xl">
              {loading ? "—" : stats.sent}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="group">
              <article className="ps-card ps-gloss h-full p-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-(--ink)/25 group-hover:shadow-[0_18px_44px_-24px_rgba(10,10,12,0.6)]">
                <div className="relative flex items-start justify-between">
                  <div
                    className={
                      card.alert
                        ? "flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-(--on-ink)"
                        : "flex h-10 w-10 items-center justify-center rounded-xl bg-(--ink) text-(--on-ink)"
                    }
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-(--heading)/25 transition group-hover:text-(--heading)" />
                </div>

                <p className="relative mt-6 text-4xl font-semibold tracking-[-0.04em] tabular-nums text-(--heading)">
                  {loading ? "—" : card.value}
                </p>

                <div className="ps-chrome-rule relative mt-4" />

                <div className="relative mt-3 flex items-baseline justify-between">
                  <p className="text-sm font-medium text-(--heading)">{card.label}</p>
                  <p className="text-[11px] font-light text-(--muted-text)">{card.note}</p>
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="group">
              <article className="ps-card h-full p-6 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-(--ink)/25 group-hover:shadow-[0_18px_44px_-24px_rgba(10,10,12,0.6)]">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-(--ink)/10 bg-(--surface) text-(--heading) shadow-sm transition group-hover:bg-(--ink) group-hover:text-(--on-ink)">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="relative mt-5 text-base font-semibold tracking-[-0.02em] text-(--heading)">
                  {link.title}
                </h2>
                <p className="relative mt-1.5 text-sm font-light leading-relaxed text-(--muted-text)">
                  {link.description}
                </p>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-(--heading)/50 transition group-hover:text-(--heading)">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
