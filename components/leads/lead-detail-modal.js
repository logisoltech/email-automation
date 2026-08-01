"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/query";
import { getBudgetTier, getBudgetTierLabel } from "@/lib/leads/budget-tier";

/**
 * @param {{ label: string; children: import("react").ReactNode }} props
 */
function DetailField({ label, children }) {
  if (children === null || children === undefined || children === "") {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-(--muted-text)">
          {label}
        </p>
        <div className="mt-1 text-sm text-(--muted-text)">—</div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-(--muted-text)">
        {label}
      </p>
      <div className="mt-1 text-sm text-(--heading)">{children}</div>
    </div>
  );
}

/**
 * @param {{
 *   open: boolean;
 *   leadId: string | null;
 *   onClose: () => void;
 *   onEdit?: (lead: Record<string, unknown>) => void;
 *   onDeleted?: () => void;
 * }} props
 */
export function LeadDetailModal({ open, leadId, onClose, onEdit, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState(null);

  useEffect(() => {
    if (!open || !leadId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setLead(null);

    fetchJson(`/api/leads/${leadId}`)
      .then((data) => {
        if (!cancelled) setLead(data.lead);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load lead.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const emails = lead?.emails || [];
  const budget = lead?.budget || "";
  const tier = budget ? getBudgetTierLabel(getBudgetTier(budget)) : "";

  async function handleDelete() {
    if (!leadId || !lead) return;
    if (!confirm(`Delete lead “${lead.name}”? This cannot be undone.`)) return;

    setDeleting(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${leadId}`, { method: "DELETE" });
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-(--ink)/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-(--ink)/12 bg-(--surface) shadow-[0_24px_60px_-28px_rgba(10,10,12,0.55)]">
        <div className="flex shrink-0 items-start justify-between border-b border-(--ink)/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-(--muted-text)">
              Lead details
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-(--heading)">
              {loading ? "Loading…" : lead?.name || "Lead"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--muted-text) transition hover:bg-(--ink)/6 hover:text-(--heading)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-(--muted-text)">Loading lead…</p>
          ) : null}
          {!loading && lead ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Date">{lead.lead_date}</DetailField>
              <DetailField label="Subcategory">{lead.subcategory_name}</DetailField>
              <DetailField label="Email">
                {emails.length ? (
                  <div className="space-y-1">
                    {emails.map((email) => (
                      <a
                        key={email}
                        href={`mailto:${email}`}
                        className="block truncate text-(--heading) underline decoration-(--ink)/25 underline-offset-2 hover:decoration-(--ink)"
                      >
                        {email}
                      </a>
                    ))}
                  </div>
                ) : null}
              </DetailField>
              <DetailField label="Phone">{lead.phone}</DetailField>
              <DetailField label="Budget">
                {budget ? (
                  <span>
                    {budget}
                    {tier ? (
                      <span className="ml-1 text-xs uppercase text-(--muted-text)">({tier})</span>
                    ) : null}
                  </span>
                ) : null}
              </DetailField>
              <DetailField label="Service / category">{lead.category}</DetailField>
              <DetailField label="Website">
                {lead.website_url ? (
                  <a
                    href={lead.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate underline decoration-(--ink)/25 underline-offset-2 hover:decoration-(--ink)"
                  >
                    <span className="truncate">{lead.website_url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </DetailField>
              <DetailField label="Country">{lead.country}</DetailField>
              <div className="sm:col-span-2">
                <DetailField label="Social media links">
                  {lead.social_media_links ? (
                    <div className="whitespace-pre-wrap break-words">
                      {lead.social_media_links}
                    </div>
                  ) : null}
                </DetailField>
              </div>
              <div className="sm:col-span-2">
                <DetailField label="Description">
                  {lead.project_description ? (
                    <p className="whitespace-pre-wrap">{lead.project_description}</p>
                  ) : null}
                </DetailField>
              </div>
              <div className="sm:col-span-2">
                <DetailField label="Notes">
                  {lead.notes ? <p className="whitespace-pre-wrap">{lead.notes}</p> : null}
                </DetailField>
              </div>
            </div>
          ) : null}
        </div>

        {!loading && lead ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--ink)/10 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              loading={deleting}
              onClick={handleDelete}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onEdit?.(lead);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
