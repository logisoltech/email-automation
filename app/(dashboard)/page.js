"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MailPlus, History, Clock, Users, Megaphone, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    sent: 0,
    failed: 0,
    scheduled: 0,
    campaigns: 0,
    campaignSent: 0,
  });

  useEffect(() => {
    fetch("/api/analytics/stats")
      .then((res) => (res.ok ? res.json() : { stats: null }))
      .then((data) => {
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {});
  }, []);

  const statCards = [
    { label: "Emails sent", value: String(stats.sent), icon: MailPlus, note: "All time", href: "/history" },
    { label: "Scheduled", value: String(stats.scheduled), icon: Clock, note: "Pending", href: "/history" },
    { label: "Campaigns", value: String(stats.campaigns), icon: Megaphone, note: `${stats.campaignSent} sent`, href: "/campaigns" },
    { label: "Failed", value: String(stats.failed), icon: History, note: "Needs review", href: "/history" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Phase 3 is live — schedule sends, run campaigns, and switch AI providers via env.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="p-5 transition-colors hover:border-blue-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-blue-600">{stat.note}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Phase 3 features" description="Now available for your team.">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              Schedule emails from Compose
            </li>
            <li className="flex gap-2">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              Batch campaigns to multiple recipients
            </li>
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              OpenAI support — set <code className="text-xs">AI_PROVIDER=openai</code>
            </li>
          </ul>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/compose"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              Compose
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              Campaigns
            </Link>
          </div>
        </Card>

        <Card title="Scheduling setup" description="Required for scheduled sends to go out.">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>1. Run migration <code className="text-xs">002_phase3_campaigns.sql</code> in Supabase</li>
            <li>2. Add <code className="text-xs">CRON_SECRET</code> to Vercel env vars</li>
            <li>3. Deploy — Vercel cron runs every minute in production</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Locally, scheduled emails stay pending until the cron endpoint is called.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
            <Users className="h-4 w-4" />
            4 team members @logisol.tech
          </div>
        </Card>
      </div>
    </div>
  );
}
