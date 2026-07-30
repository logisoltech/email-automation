"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Sticky verify-email toast with live countdown + depleting progress bar.
 * @param {{
 *   toastId: string | number;
 *   email: string;
 *   seconds?: number;
 *   onDone: () => void;
 * }} props
 */
export function VerifyEmailToast({ toastId, email, seconds = 3, onDone }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onDone]);

  return (
    <div className="relative w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-(--ink)/10 bg-(--surface) shadow-[0_22px_50px_-24px_rgba(10,10,12,0.65)] ring-1 ring-(--ink)/5">
      <div className="flex items-start gap-3 p-4 pr-10">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--ink) text-(--on-ink)">
          <Mail className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold tracking-[-0.02em] text-(--heading)">
            Verify your email
          </p>
          <p className="mt-1 text-xs font-light leading-relaxed text-(--muted-text)">
            We sent a confirmation link to <span className="font-medium text-(--heading)">{email}</span>.
            Redirecting to sign in in{" "}
            <span className="font-semibold tabular-nums text-(--heading)">{left}</span>…
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(toastId);
            onDone();
          }}
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-(--heading)/35 transition hover:bg-(--ink)/5 hover:text-(--heading)"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-1 w-full bg-(--ink)/6">
        <div
          className="h-full origin-left bg-(--ink)"
          style={{
            animation: `ps-toast-progress ${seconds * 1000}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
