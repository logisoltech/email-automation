"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Plus,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Sent
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }

  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5" />
        Scheduled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {status}
    </span>
  );
}

/**
 * @param {{ bodyHtml?: string; bodyText?: string }} email
 */
function getEmailBodyHtml(email) {
  if (email.bodyHtml?.includes("<p") || email.bodyHtml?.includes("<br")) {
    return email.bodyHtml;
  }

  if (email.bodyText) {
    return email.bodyText
      .split(/\n\n+/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
      .join("");
  }

  return email.bodyHtml || "";
}

function EmailBody({ email }) {
  const html = getEmailBodyHtml({
    bodyHtml: email.body_html,
    bodyText: email.body_text,
  });

  if (!html) {
    return <p className="text-sm text-slate-500">No email body saved.</p>;
  }

  return (
    <div
      className="text-sm leading-relaxed text-slate-800 [&_a]:text-blue-600 [&_a]:underline [&_br]:block [&_p]:mb-3 [&_p:last-child]:mb-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function HistoryPage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [resultCount, setResultCount] = useState(0);

  const loadHistory = useCallback(async (query, status) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);

    const url = params.toString()
      ? `/api/emails/history?${params.toString()}`
      : "/api/emails/history";

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load history.");
      }
      setEmails(data.emails ?? []);
      setResultCount(data.total ?? data.emails?.length ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadHistory(search, statusFilter);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, statusFilter, loadHistory]);

  const hasFilters = search.trim() || statusFilter !== "all";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">History</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Search and read every email your team has sent.
          </p>
        </div>
        <Link
          href="/compose"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New email
        </Link>
      </div>

      <Card className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, recipient, or email body..."
            className="pl-10"
            aria-label="Search history"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={
                statusFilter === filter.value
                  ? "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!loading && !error ? (
          <p className="text-xs text-slate-500">
            {hasFilters
              ? `${emails.length} result${emails.length === 1 ? "" : "s"}`
              : `Showing ${emails.length} most recent`}
            {resultCount > emails.length ? ` (of ${resultCount} matches)` : ""}
          </p>
        ) : null}
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading history...</p>
        </Card>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && emails.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Mail className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              {hasFilters ? "No matching emails" : "No emails yet"}
            </p>
            <p className="max-w-sm text-sm text-slate-500">
              {hasFilters
                ? "Try a different search term or clear your filters."
                : "Compose your first AI-assisted email and it will show up here."}
            </p>
            {!hasFilters ? (
              <Link
                href="/compose"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Go to Compose
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!loading && emails.length > 0 ? (
        <div className="space-y-3">
          {emails.map((email) => {
            const isExpanded = expandedId === email.id;

            return (
              <Card key={email.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5"
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{email.subject}</h2>
                      <StatusBadge status={email.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      To: {email.recipients?.join(", ") || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {email.status === "sent"
                        ? `Sent ${formatDate(email.sent_at)}`
                        : email.status === "scheduled"
                          ? `Scheduled ${formatDate(email.scheduled_at)}`
                          : `Created ${formatDate(email.created_at)}`}
                      {email.ai_provider ? ` · ${email.ai_provider}` : ""}
                    </p>
                    {!isExpanded && email.body_text ? (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                        {email.body_text}
                      </p>
                    ) : null}
                    {email.error_message ? (
                      <p className="mt-2 text-sm text-red-600">{email.error_message}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
                    {email.ai_prompt ? (
                      <p className="mb-3 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Context:</span>{" "}
                        {email.ai_prompt}
                      </p>
                    ) : null}
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <EmailBody email={email} />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
