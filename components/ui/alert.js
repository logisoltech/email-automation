"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils/cn";

/**
 * @param {{ children: import("react").ReactNode; className?: string; variant?: "error" | "success" | "info" }} props
 */
export function Alert({ children, className, variant = "info" }) {
  const lastKey = useRef("");

  const text =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  useEffect(() => {
    if (variant !== "error" && variant !== "success") return;
    if (!text) return;

    const key = `${variant}:${text}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (variant === "error") {
      notify.error(text, { id: key });
    } else {
      notify.success(text, { id: key });
    }
  }, [text, variant]);

  if (variant === "error" || variant === "success") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-(--ink)/12 bg-(--ink)/4 px-4 py-3 text-sm font-light text-(--heading)",
        className
      )}
    >
      {children}
    </div>
  );
}
