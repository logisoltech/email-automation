"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Ink-panel campaign detail modal (themeable via --ink / streaks).
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   campaignId: string | null;
 * }} props
 */
export function CampaignDetailModal({ open, onClose, campaignId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!open || !campaignId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setExpandedId(null);

    fetch(`/api/campaigns/${campaignId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        setCampaign(data.campaign);
        setLeads(data.leads ?? []);
        setStats(data.stats);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, campaignId]);

  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-(--ink)/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "ps-panel-ink ps-streaks relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden"
        )}
      >
        <div className="relative flex shrink-0 items-start justify-between border-b border-(--on-ink)/10 px-6 py-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-(--on-ink)/45">
              Campaign
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-(--on-ink)">
              {campaign?.name || "Loading…"}
            </h2>
            {campaign?.category?.name ? (
              <p className="mt-1 text-xs font-light text-(--on-ink)/50">
                {campaign.category.name} · {campaign.status}
              </p>
            ) : campaign ? (
              <p className="mt-1 text-xs font-light text-(--on-ink)/50">{campaign.status}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--on-ink)/50 transition hover:bg-(--on-ink)/10 hover:text-(--on-ink)"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {stats ? (
          <div className="relative flex shrink-0 flex-wrap gap-3 border-b border-(--on-ink)/10 px-6 py-3 text-xs text-(--on-ink)/60">
            <span>{stats.total} recipients</span>
            <span>{stats.sent} sent</span>
            <span>{stats.generated} ready</span>
            <span>{stats.failed} failed</span>
            <span>{stats.pending} pending</span>
          </div>
        ) : null}

        <div className="ps-scroll-chrome relative min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-(--on-ink)/50">Loading recipients…</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          {!loading && !error && leads.length === 0 ? (
            <div className="space-y-2 text-sm text-(--on-ink)/70">
              <p>No linked leads on this campaign.</p>
              {campaign?.recipients?.length ? (
                <p className="text-(--on-ink)/45">
                  Legacy recipients: {campaign.recipients.join(", ")}
                </p>
              ) : null}
              {campaign?.body_text ? (
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-4 text-xs text-(--on-ink)/80">
                  {campaign.subject ? `${campaign.subject}\n\n` : ""}
                  {campaign.body_text}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            {leads.map((row) => {
              const lead = row.leads;
              const openRow = expandedId === row.id;
              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-(--on-ink)/10 bg-(--on-ink)/5"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setExpandedId(openRow ? null : row.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-(--on-ink)">{lead?.name || "Unknown"}</p>
                      <p className="truncate text-xs text-(--on-ink)/50">
                        {(lead?.emails || []).join(", ")}
                      </p>
                      {row.subject ? (
                        <p className="mt-1 truncate text-xs text-(--on-ink)/70">{row.subject}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-(--on-ink)/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-(--on-ink)/70">
                      {row.status}
                    </span>
                  </button>
                  {openRow ? (
                    <div className="border-t border-(--on-ink)/10 px-4 py-3 text-sm text-(--on-ink)/80">
                      {row.error_message ? (
                        <p className="mb-2 text-xs text-red-300">{row.error_message}</p>
                      ) : null}
                      {row.sent_at ? (
                        <p className="mb-2 text-xs text-(--on-ink)/45">
                          Sent {new Date(row.sent_at).toLocaleString()}
                        </p>
                      ) : null}
                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-(--on-ink)/75">
                        {row.body_text || "No email body yet."}
                      </pre>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
