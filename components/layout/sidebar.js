"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  History,
  Megaphone,
  Settings,
  FileText,
  Users,
  Sparkles,
  X,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Personalized", icon: Mail },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/instructions", label: "AI Instructions", icon: Sparkles },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * @param {{
 *   onNavigate?: () => void;
 *   onClose?: () => void;
 *   mobile?: boolean;
 *   workspace?: { id: string; name: string; role?: string } | null;
 *   workspaces?: Array<{ id: string; name: string }>;
 *   onSwitchWorkspace?: (id: string) => void;
 * }} props
 */
export function Sidebar({
  onNavigate,
  onClose,
  mobile = false,
  workspace,
  workspaces = [],
  onSwitchWorkspace,
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      className={cn(
        "ps-streaks ps-ink-gradient relative flex h-full flex-col overflow-hidden text-(--on-ink)/70",
        mobile ? "w-full" : "w-64 border-r border-(--on-ink)/10"
      )}
    >
      <div className="relative flex shrink-0 items-center justify-between border-b border-(--on-ink)/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="ps-chrome-tile flex h-10 w-10 items-center justify-center rounded-xl text-(--ink)">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-(--on-ink)">OutreachOS</p>
            <p className="text-[11px] font-light uppercase tracking-[0.18em] text-(--on-ink)/35">
              Outreach
            </p>
          </div>
        </div>
        {mobile && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--on-ink)/50 hover:bg-(--on-ink)/10 hover:text-(--on-ink)"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {workspace ? (
        <div className="relative shrink-0 border-b border-(--on-ink)/10 px-3 py-3">
          <label className="mb-1.5 block px-2 text-[10px] font-medium uppercase tracking-[0.22em] text-(--on-ink)/35">
            Workspace
          </label>
          <div className="relative">
            <select
              className="h-10 w-full appearance-none rounded-xl border border-(--on-ink)/15 bg-(--on-ink)/5 px-3 pr-8 text-sm text-(--on-ink) outline-none transition focus:border-(--on-ink)/45"
              value={workspace.id}
              onChange={(e) => onSwitchWorkspace?.(e.target.value)}
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.id} className="text-(--ink)">
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--on-ink)/40" />
          </div>
        </div>
      ) : null}

      <nav className="ps-scroll-chrome relative min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                isActive
                  ? "bg-(--on-ink) font-medium text-(--ink)!"
                  : "font-light text-(--on-ink)/60 hover:bg-(--on-ink)/[0.07] hover:text-(--on-ink)"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative shrink-0 border-t border-(--on-ink)/10 bg-(--ink-deep)/40 px-5 py-4">
        <button
          type="button"
          className="text-xs font-light uppercase tracking-[0.16em] text-(--on-ink)/40 transition hover:text-(--on-ink)"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
