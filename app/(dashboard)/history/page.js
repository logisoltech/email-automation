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
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";

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
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-(--body)">
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
    return <p className="text-sm text-(--muted-text)">No email body saved.</p>;
  }

  return (
    <div
      className="text-sm leading-relaxed text-(--body) [&_a]:text-(--heading) [&_a]:underline [&_a]:decoration-(--ink)/25 [&_a]:underline-offset-4 [&_br]:block [&_p]:mb-3 [&_p:last-child]:mb-0"
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const loadHistory = useCallback(async (query, status, requestedPage) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    params.set("page", String(requestedPage));
    params.set("pageSize", String(pageSize));

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
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadHistory(search, statusFilter, page);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, statusFilter, page, loadHistory]);

  const hasFilters = search.trim() || statusFilter !== "all";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">
            Search and read every email your team has sent.
          </p>
        </div>
        <Link
          href="/compose"
          className="ps-streaks inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--ink) px-4 text-sm font-medium text-(--on-ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)] transition hover:bg-[#22222a]"
        >
          <Plus className="h-4 w-4" />
          New email
        </Link>
      </div>

      <Card className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted-text)" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject, exact recipient email, or email body..."
            className="pl-10"
            aria-label="Search history"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setStatusFilter(filter.value);
                setPage(1);
              }}
              className={
                statusFilter === filter.value
                  ? "ps-streaks rounded-full bg-(--ink) px-3 py-1.5 text-xs font-medium text-(--on-ink)"
                  : "rounded-full border border-(--ink)/8 bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--body) transition hover:border-(--ink)/25 hover:text-(--heading)"
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!loading && !error ? (
          <p className="text-xs text-(--muted-text)">
            {hasFilters
              ? `${resultCount} result${resultCount === 1 ? "" : "s"}`
              : `${resultCount} emails`}
          </p>
        ) : null}
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-(--muted-text)">Loading history...</p>
        </Card>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!loading && !error && emails.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="ps-streaks rounded-xl bg-(--ink) p-3 text-(--on-ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)]">
              <Mail className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-(--heading)">
              {hasFilters ? "No matching emails" : "No emails yet"}
            </p>
            <p className="max-w-sm text-sm text-(--muted-text)">
              {hasFilters
                ? "Try a different search term or clear your filters."
                : "Write your first personalized email and it will show up here."}
            </p>
            {!hasFilters ? (
              <Link
                href="/compose"
                className="ps-streaks inline-flex h-11 items-center justify-center rounded-xl bg-(--ink) px-4 text-sm font-medium text-(--on-ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)] transition hover:bg-[#22222a]"
              >
                Go to Personalized
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
              <Card
                key={email.id}
                className="overflow-hidden p-0 transition hover:border-(--ink)/25"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-(--ink)/2 sm:p-5"
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-(--heading)">{email.subject}</h2>
                      <StatusBadge status={email.status} />
                    </div>
                    <p className="mt-2 text-sm text-(--body)">
                      To: {email.recipients?.join(", ") || "—"}
                    </p>
                    <p className="mt-1 text-xs text-(--muted-text)">
                      {email.status === "sent"
                        ? `Sent ${formatDate(email.sent_at)}`
                        : email.status === "scheduled"
                          ? `Scheduled ${formatDate(email.scheduled_at)}`
                          : `Created ${formatDate(email.created_at)}`}
                      {email.ai_provider ? ` · ${email.ai_provider}` : ""}
                    </p>
                    {!isExpanded && email.body_text ? (
                      <p className="mt-2 line-clamp-2 text-sm text-(--muted-text)">
                        {email.body_text}
                      </p>
                    ) : null}
                    {email.error_message ? (
                      <p className="mt-2 text-sm text-red-600">{email.error_message}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-(--muted-text)">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="border-t border-(--ink)/8 bg-(--ink)/2.5 px-4 py-4 sm:px-5">
                    {email.ai_prompt ? (
                      <p className="mb-3 text-xs text-(--muted-text)">
                        <span className="font-medium text-(--body)">Context:</span>{" "}
                        {email.ai_prompt}
                      </p>
                    ) : null}
                    <div className="rounded-xl border border-(--ink)/10 bg-(--surface) p-4 shadow-[0_1px_0_var(--surface)_inset]">
                      <EmailBody email={email} />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={resultCount}
            pageSize={pageSize}
            disabled={loading}
            onPageChange={(nextPage) => {
              setExpandedId(null);
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
