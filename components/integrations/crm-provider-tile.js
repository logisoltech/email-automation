"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Visual shell for a CRM provider on the Integrations page.
 * @param {{
 *   name: string;
 *   logoSrc: string;
 *   tagline: string;
 *   features?: string[];
 *   loading?: boolean;
 *   busy?: boolean;
 *   configured: boolean;
 *   connected: boolean;
 *   accountName?: string | null;
 *   lastSyncAt?: string | null;
 *   lastError?: string | null;
 *   isOwner: boolean;
 *   onRefresh: () => void;
 *   onConnect?: () => void;
 *   onDisconnect?: () => void;
 *   connectLabel?: string;
 *   className?: string;
 * }} props
 */
export function CrmProviderTile({
  name,
  logoSrc,
  tagline,
  features = [],
  loading = false,
  busy = false,
  configured,
  connected,
  accountName,
  lastSyncAt,
  lastError,
  isOwner,
  onRefresh,
  onConnect,
  onDisconnect,
  connectLabel,
  className,
}) {
  let statusLabel = "Available";
  let statusTone = "idle";
  if (loading) {
    statusLabel = "Checking…";
    statusTone = "idle";
  } else if (!configured) {
    statusLabel = "Needs setup";
    statusTone = "warn";
  } else if (connected) {
    statusLabel = "Connected";
    statusTone = "ok";
  } else {
    statusLabel = "Not connected";
    statusTone = "idle";
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-(--ink)/10 bg-(--surface)",
        "shadow-[0_14px_36px_-28px_rgba(10,10,12,0.5)] transition duration-300",
        "hover:-translate-y-0.5 hover:border-(--ink)/18",
        "animate-[crm-tile-in_420ms_ease-out_both]",
        className
      )}
    >
      <div className="relative flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-(--ink)/8 bg-(--page-hi)">
              <img
                src={logoSrc}
                alt={`${name} logo`}
                width={28}
                height={28}
                className="h-7 w-7"
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-(--heading)">
                  {name}
                </h2>
                <StatusChip tone={statusTone} label={statusLabel} />
              </div>
              <p className="mt-1 text-sm font-light leading-relaxed text-(--muted-text)">
                {tagline}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading || busy}
            className="shrink-0"
            aria-label={`Refresh ${name}`}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {features.length ? (
          <ul className="flex flex-wrap gap-2">
            {features.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-(--ink)/8 bg-(--surface-lo)/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-(--muted-text)"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-(--ink)/8 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-sm">
            {loading ? (
              <p className="text-(--muted-text)">Checking connection…</p>
            ) : !configured ? (
              <p className="text-(--muted-text)">
                Add server credentials to unlock Connect for this workspace.
              </p>
            ) : connected ? (
              <div className="space-y-1">
                <p className="text-(--body)">
                  Linked
                  {accountName ? (
                    <>
                      {" "}
                      to <span className="font-medium text-(--heading)">{accountName}</span>
                    </>
                  ) : (
                    " to your CRM account"
                  )}
                </p>
                {lastSyncAt ? (
                  <p className="text-xs text-(--muted-text)">
                    Last import {new Date(lastSyncAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-(--muted-text)">
                    Ready to import contacts from Leads.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-(--muted-text)">
                Connect once — then import contacts and sync send/open status automatically.
              </p>
            )}
            {lastError ? <p className="mt-2 text-xs text-red-600">{lastError}</p> : null}
            {configured && !isOwner ? (
              <p className="mt-2 text-xs text-(--muted-text)">
                Only the workspace owner can connect or disconnect.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {configured && connected && isOwner && onDisconnect ? (
              <Button variant="secondary" onClick={onDisconnect} loading={busy}>
                Disconnect
              </Button>
            ) : null}
            {configured && !connected && isOwner && onConnect ? (
              <Button onClick={onConnect} loading={busy}>
                {connectLabel || `Connect ${name}`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * @param {{ tone: "ok" | "warn" | "idle"; label: string }} props
 */
function StatusChip({ tone, label }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
    warn: "bg-amber-50 text-amber-800 ring-amber-200/80",
    idle: "bg-(--ink)/5 text-(--muted-text) ring-(--ink)/10",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
        styles[tone]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-sm",
          tone === "ok" && "bg-emerald-500",
          tone === "warn" && "bg-amber-500",
          tone === "idle" && "bg-(--ink)/35"
        )}
      />
      {label}
    </span>
  );
}
