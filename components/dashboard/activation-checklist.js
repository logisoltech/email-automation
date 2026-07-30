"use client";

import Link from "next/link";
import { Check, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{
 *   activation: {
 *     steps: Array<{ id: string; title: string; hint: string; href: string; done: boolean }>;
 *     doneCount: number;
 *     totalCount: number;
 *     sendsPerHour?: number;
 *   };
 *   onDismiss: () => void;
 *   dismissing?: boolean;
 * }} props
 */
export function ActivationChecklist({ activation, onDismiss, dismissing = false }) {
  const { steps, doneCount, totalCount, sendsPerHour } = activation;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <section className="ps-card relative overflow-hidden p-6 sm:p-7">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-(--muted-text)">
            Getting started
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-(--heading)">
            First-win checklist
          </h2>
          <p className="mt-1 text-sm font-light text-(--muted-text)">
            Complete these steps to send your first personalized outreach.
            {sendsPerHour ? (
              <>
                {" "}
                This workspace sends up to{" "}
                <span className="font-medium text-(--heading)">{sendsPerHour}/hour</span> to
                protect your mailbox.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium tabular-nums text-(--heading)">
            {doneCount}/{totalCount} complete
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            loading={dismissing}
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      </div>

      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-(--ink)/8">
        <div
          className="h-full rounded-full bg-(--ink) transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="relative mt-6 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="group flex items-start gap-3 rounded-xl border border-(--ink)/8 px-3.5 py-3 transition hover:border-(--ink)/25 hover:bg-(--surface)"
            >
              <span
                className={
                  step.done
                    ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--ink) text-(--on-ink)"
                    : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--ink)/20 text-xs font-medium text-(--heading)/50"
                }
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={
                      step.done
                        ? "text-sm font-medium text-(--muted-text) line-through"
                        : "text-sm font-medium text-(--heading)"
                    }
                  >
                    {step.title}
                  </p>
                  {!step.done ? (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-(--heading)/30 transition group-hover:translate-x-0.5 group-hover:text-(--heading)" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs font-light text-(--muted-text)">{step.hint}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
