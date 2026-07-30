"use client";

import { Menu } from "lucide-react";

/**
 * @param {{
 *   onMenuClick?: () => void;
 *   userEmail?: string;
 *   workspaceName?: string;
 * }} props
 */
export function Header({ onMenuClick, userEmail, workspaceName }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-(--ink)/10 bg-(--surface)/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-xl p-2 text-(--heading)/60 transition hover:bg-(--ink)/5 hover:text-(--heading) lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
        <div>
          <p className="text-sm font-semibold tracking-[-0.02em] text-(--heading)">
            {workspaceName || "Workspace"}
          </p>
          <p className="text-[10px] font-light uppercase tracking-[0.2em] text-(--muted-text)">
            AI outreach
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-light text-(--heading)">{userEmail || "—"}</p>
          <p className="text-[10px] font-light uppercase tracking-[0.2em] text-(--muted-text)">
            Signed in
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--ink) text-sm font-medium text-(--on-ink)">
          {(userEmail || "?").slice(0, 1).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
