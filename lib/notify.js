"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

/**
 * @param {{
 *   id: string | number;
 *   title: string;
 *   description?: string;
 *   variant?: "success" | "error" | "info";
 *   duration?: number;
 *   showProgress?: boolean;
 * }} props
 */
export function ToastCard({
  id,
  title,
  description,
  variant = "info",
  duration = 4500,
  showProgress = true,
}) {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
  };
  const Icon = icons[variant] || Info;

  const iconWrap = {
    success: "bg-(--ink) text-(--on-ink)",
    error: "bg-red-600 text-(--on-ink)",
    info: "bg-(--ink)/8 text-(--heading)",
  };

  const barColor = {
    success: "bg-(--ink)",
    error: "bg-red-600",
    info: "bg-(--ink)/70",
  };

  const finite = Number.isFinite(duration) && duration > 0 && showProgress;

  return (
    <div
      className={cn(
        "relative w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-(--ink)/10 bg-(--surface) shadow-[0_22px_50px_-24px_rgba(10,10,12,0.65)]",
        "ring-1 ring-(--ink)/5"
      )}
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconWrap[variant]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold tracking-[-0.02em] text-(--heading)">{title}</p>
          {description ? (
            <p className="mt-1 text-xs font-light leading-relaxed text-(--muted-text)">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-(--heading)/35 transition hover:bg-(--ink)/5 hover:text-(--heading)"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {finite ? (
        <div className="h-1 w-full bg-(--ink)/6">
          <div
            className={cn("h-full origin-left", barColor[variant])}
            style={{
              animation: `ps-toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   description?: string;
 *   duration?: number;
 *   id?: string | number;
 *   showProgress?: boolean;
 * }} options
 */
function show(variant, options) {
  const duration = options.duration ?? (variant === "error" ? 5500 : 4500);
  const id = options.id ?? `${variant}-${Date.now()}`;

  return toast.custom(
    (toastId) => (
      <ToastCard
        id={toastId}
        title={options.title}
        description={options.description}
        variant={variant}
        duration={duration}
        showProgress={options.showProgress !== false}
      />
    ),
    {
      id,
      duration,
      unstyled: true,
      className: "w-auto!",
    }
  );
}

export const notify = {
  success(title, descriptionOrOptions, maybeOptions) {
    const { description, ...options } = normalizeArgs(descriptionOrOptions, maybeOptions);
    return show("success", { title, description, ...options });
  },
  error(title, descriptionOrOptions, maybeOptions) {
    const { description, ...options } = normalizeArgs(descriptionOrOptions, maybeOptions);
    return show("error", { title, description, ...options });
  },
  info(title, descriptionOrOptions, maybeOptions) {
    const { description, ...options } = normalizeArgs(descriptionOrOptions, maybeOptions);
    return show("info", { title, description, ...options });
  },
  dismiss(id) {
    toast.dismiss(id);
  },
};

/**
 * @param {string | Record<string, unknown> | undefined} descriptionOrOptions
 * @param {Record<string, unknown> | undefined} maybeOptions
 */
function normalizeArgs(descriptionOrOptions, maybeOptions) {
  if (typeof descriptionOrOptions === "string") {
    return { description: descriptionOrOptions, ...(maybeOptions || {}) };
  }
  if (descriptionOrOptions && typeof descriptionOrOptions === "object") {
    return descriptionOrOptions;
  }
  return maybeOptions || {};
}
