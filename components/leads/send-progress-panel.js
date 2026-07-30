"use client";

import { getSendProgress } from "@/lib/leads/send-progress";

/**
 * @param {{
 *   stats: {
 *     sent?: number;
 *     queued?: number;
 *     sending?: number;
 *     failed?: number;
 *     total?: number;
 *   } | null;
 *   sendsPerHour?: number;
 *   batchStatus?: string | null;
 * }} props
 */
export function SendProgressPanel({ stats, sendsPerHour = 100, batchStatus }) {
  if (!stats) return null;

  const progress = getSendProgress(stats, sendsPerHour);
  const isComplete = progress.complete || batchStatus === "completed";

  return (
    <div className="mb-5 rounded-xl border border-(--ink)/10 bg-(--surface) p-4 shadow-[0_1px_0_var(--surface)_inset]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-(--muted-text)">
            {isComplete ? "Batch complete" : "Sending progress"}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-(--heading)">
            {progress.sent}
            <span className="text-base font-light text-(--muted-text)">
              {" "}
              / {progress.pipeline || progress.sent}
            </span>
          </p>
          <p className="mt-1 text-sm font-light text-(--muted-text)">
            {isComplete
              ? `${progress.sent} sent${progress.failed ? ` · ${progress.failed} failed` : ""}`
              : `${progress.remaining} left in queue · ${progress.rateLabel}`}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-(--heading)">
            {isComplete ? "Finished" : progress.etaLabel}
          </p>
          {!isComplete ? (
            <p className="mt-0.5 text-xs font-light text-(--muted-text)">
              Paced to protect your mailbox — not stuck.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--ink)/8">
        <div
          className="h-full rounded-full bg-(--ink) transition-all duration-700 ease-out"
          style={{ width: `${isComplete ? 100 : progress.percent}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700">
          Sent {progress.sent}
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
          Queued {stats.queued ?? 0}
        </span>
        {(stats.sending ?? 0) > 0 ? (
          <span className="rounded-full bg-(--ink)/5 px-2.5 py-1 font-medium text-(--heading)">
            Sending {stats.sending}
          </span>
        ) : null}
        {(stats.failed ?? 0) > 0 ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">
            Failed {stats.failed}
          </span>
        ) : null}
      </div>
    </div>
  );
}
