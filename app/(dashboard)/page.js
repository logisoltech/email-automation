"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MailPlus,
  Clock,
  Megaphone,
  ArrowRight,
  ArrowUpRight,
  Globe,
  Share2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { ActivationChecklist } from "@/components/dashboard/activation-checklist";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    sent: 0,
    scheduled: 0,
    failed: 0,
    campaigns: 0,
    campaignSent: 0,
  });
  const [workspaceName, setWorkspaceName] = useState("");
  const [activation, setActivation] = useState(null);
  const [dismissing, setDismissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/stats").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/activation").then((r) => r.json()),
    ])
      .then(([statsData, sessionData, activationData]) => {
        if (statsData?.stats && !statsData.error) {
          setStats((current) => ({ ...current, ...statsData.stats }));
        }
        setWorkspaceName(sessionData.workspace?.name || "");
        if (activationData?.activation) {
          setActivation(activationData.activation);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function dismissActivation() {
    setDismissing(true);
    try {
      const res = await fetch("/api/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: true }),
      });
      if (res.ok) {
        setActivation((current) =>
          current ? { ...current, dismissed: true, visible: false } : current
        );
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
    {
      label: "Failed",
      value: stats.failed,
      icon: AlertTriangle,
      note: "Needs review",
      href: "/history",
      alert: stats.failed > 0,
    },
  ];

  const quickLinks = [
    {
      href: "/compose",
      title: "Compose email",
      description: "Write with AI, then send or schedule it.",
      icon: Sparkles,
    },
    {
      href: "/import/website",
      title: "Website leads",
      description: "Paste Sheets rows and personalize at scale.",
      icon: Globe,
    },
    {
      href: "/import/smm",
      title: "SMM leads",
      description: "Outreach built for marketing prospects.",
      icon: Share2,
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
                Compose email
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/import/website"
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
