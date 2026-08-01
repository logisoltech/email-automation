"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/ui/pagination";
import { fetchJson, queryKeys } from "@/lib/query";

const PAGE_SIZE = 20;

/**
 * @param {string} value
 * @returns {string[]}
 */
export function parseRecipientEmails(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,;\n]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

/**
 * @param {string[]} emails
 */
function formatRecipients(emails) {
  return emails.join(", ");
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   selectedEmails: string[];
 *   onConfirm: (emails: string[]) => void;
 * }} props
 */
function LeadRecipientModal({ open, onClose, selectedEmails, onConfirm }) {
  const [categoryId, setCategoryId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState(() => new Set());

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => fetchJson("/api/leads/categories"),
    enabled: open,
    staleTime: 3 * 60_000,
  });
  const categories = categoriesQuery.data?.categories ?? [];

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(selectedEmails.map((e) => e.toLowerCase())));
    setCategoryId("");
    setPage(1);
    setQ("");
    setSearchInput("");
  }, [open]); // only reset when modal opens — not on every selectedEmails identity change

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(selectedEmails.map((e) => e.toLowerCase())));
  }, [open, selectedEmails]);

  const leadsQuery = useQuery({
    // Dedicated key so we don't clash with /leads or campaign picker caches
    queryKey: ["leads", "recipients", categoryId || "all", page, q, PAGE_SIZE],
    queryFn: async ({ queryKey }) => {
      const activeCategoryId = String(queryKey[2] === "all" ? "" : queryKey[2] || "");
      const activePage = Number(queryKey[3]) || 1;
      const activeQ = String(queryKey[4] || "");
      const activePageSize = Number(queryKey[5]) || PAGE_SIZE;

      const params = new URLSearchParams({
        page: String(activePage),
        pageSize: String(activePageSize),
      });
      if (activeCategoryId) params.set("categoryId", activeCategoryId);
      if (activeQ) params.set("q", activeQ);
      return fetchJson(`/api/leads?${params}`);
    },
    enabled: open,
    staleTime: 30_000,
  });

  const leads = leadsQuery.data?.leads ?? [];
  const pagination = leadsQuery.data?.pagination ?? {
    page,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };
  const showLoading = leadsQuery.isPending || (leadsQuery.isFetching && !leadsQuery.data);

  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const leadEmailOptions = useMemo(() => {
    return leads.flatMap((lead) => {
      const emails = (lead.emails || []).map((e) => String(e).trim()).filter(Boolean);
      if (!emails.length) {
        return [
          {
            key: `${lead.id}-none`,
            leadId: lead.id,
            name: lead.name,
            email: "",
            disabled: true,
          },
        ];
      }
      return emails.map((email) => ({
        key: `${lead.id}-${email.toLowerCase()}`,
        leadId: lead.id,
        name: lead.name,
        email,
        disabled: false,
      }));
    });
  }, [leads]);

  function toggleEmail(email) {
    const normalized = email.toLowerCase();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      return next;
    });
  }

  function selectAllVisible() {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const row of leadEmailOptions) {
        if (row.email) next.add(row.email.toLowerCase());
      }
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-(--ink)/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(90vh,42rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-(--ink)/12 bg-(--surface) shadow-[0_24px_60px_-28px_rgba(10,10,12,0.55)]">
        <div className="flex shrink-0 items-start justify-between border-b border-(--ink)/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-(--heading)">
              Select recipients
            </h2>
            <p className="mt-1 text-sm text-(--muted-text)">
              Filter on the left, pick leads on the right. You can still type emails manually after.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--muted-text) transition hover:bg-(--ink)/6 hover:text-(--heading)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
          {/* Left: filters */}
          <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-b border-(--ink)/10 px-5 py-4 md:max-h-full md:border-b-0 md:border-r md:px-6">
            <div className="space-y-3">
              <Input
                label="Search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setQ(searchInput.trim());
                  }
                }}
                placeholder="Name, email, phone…"
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setPage(1);
                  setQ(searchInput.trim());
                }}
              >
                <Search className="h-4 w-4" />
                Search
              </Button>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-(--heading)">Subcategory</span>
                <select
                  className="h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm text-(--heading) outline-none focus:border-(--ink)"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setPage(1);
                    setQ("");
                    setSearchInput("");
                  }}
                >
                  <option value="">All subcategories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {typeof c.leadCount === "number" ? ` (${c.leadCount})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-(--ink)/10 bg-(--ink)/3 p-3">
              <p className="text-sm font-medium text-(--heading)">
                <Users className="mr-1.5 inline h-4 w-4" />
                {picked.size} selected
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={selectAllVisible}>
                  Select all shown
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPicked(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          </aside>

          {/* Right: scrollable leads only */}
          <div className="min-h-0 min-w-0 overflow-y-auto px-3 py-2 sm:px-4">
            {leadsQuery.error ? (
              <p className="p-4 text-sm text-red-600">
                {leadsQuery.error.message || "Failed to load leads."}
              </p>
            ) : showLoading ? (
              <p className="p-4 text-sm text-(--muted-text)">Loading leads…</p>
            ) : leadEmailOptions.length === 0 ? (
              <p className="p-4 text-sm text-(--muted-text)">
                {categoryId
                  ? "No leads in this subcategory. Try All, or assign leads on the Leads page."
                  : "No leads match."}
              </p>
            ) : (
              <div className="space-y-1">
                {leadEmailOptions.map((row) => {
                  if (row.disabled) {
                    return (
                      <div
                        key={row.key}
                        className="rounded-xl px-3 py-2.5 text-sm text-(--muted-text) opacity-60"
                      >
                        <span className="font-medium text-(--heading)">{row.name}</span>
                        <span className="ml-2">No email on file</span>
                      </div>
                    );
                  }
                  const checked = picked.has(row.email.toLowerCase());
                  return (
                    <label
                      key={row.key}
                      className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-(--ink)/4"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0 accent-(--ink)"
                        checked={checked}
                        onChange={() => toggleEmail(row.email)}
                      />
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate text-sm font-medium text-(--heading)">
                          {row.name}
                        </span>
                        <span className="block truncate text-xs text-(--muted-text)">
                          {row.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Always-visible footer: pagination + actions */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-(--ink)/10 bg-(--surface) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 flex-1">
            {pagination.totalPages > 1 ? (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                pageSize={pagination.pageSize}
                onPageChange={setPage}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start sm:gap-4"
              />
            ) : (
              <p className="text-xs text-(--muted-text)">
                {pagination.total
                  ? `${pagination.total} lead${pagination.total === 1 ? "" : "s"}`
                  : "—"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm([...picked]);
                onClose();
              }}
            >
              Apply {picked.size} selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Recipients field: type emails manually and/or pick from leads.
 *
 * @param {{
 *   value: string;
 *   onChange: (value: string) => void;
 * }} props
 */
export function RecipientField({ value, onChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const emails = useMemo(() => parseRecipientEmails(value), [value]);

  function removeEmail(email) {
    onChange(formatRecipients(emails.filter((item) => item !== email)));
  }

  function handleConfirmFromLeads(selected) {
    onChange(formatRecipients(selected.map((e) => e.toLowerCase())));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-medium text-(--heading)">Recipients</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          <Users className="h-3.5 w-3.5" />
          Select from leads
        </Button>
      </div>

      {emails.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--ink)/12 bg-(--ink)/4 py-1 pl-2.5 pr-1 text-xs text-(--heading)"
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="rounded-full p-0.5 text-(--muted-text) transition hover:bg-(--ink)/10 hover:text-(--heading)"
                aria-label={`Remove ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type emails here, or select from leads…&#10;client@example.com, partner@example.com"
        className="min-h-24 font-mono text-xs"
      />
      <p className="text-xs text-(--muted-text)">
        Type emails yourself (comma or new line), or use Select from leads. Both work together.
      </p>

      <LeadRecipientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedEmails={emails}
        onConfirm={handleConfirmFromLeads}
      />
    </div>
  );
}
