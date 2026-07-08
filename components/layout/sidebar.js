"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  History,
  Megaphone,
  Settings,
  FileText,
  Globe,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { HiOutlineMail } from "react-icons/hi";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: Mail },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/import/website", label: "Website Leads", icon: Globe },
  { href: "/import/smm", label: "SMM Leads", icon: Share2 },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/instructions", label: "AI Instructions", icon: Sparkles },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * @param {{ onNavigate?: () => void; onClose?: () => void; mobile?: boolean }} props
 */
export function Sidebar({ onNavigate, onClose, mobile = false }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-white",
        mobile ? "w-full" : "w-64 border-r border-blue-100"
      )}
    >
      <div className="flex items-center justify-between border-b border-blue-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <HiOutlineMail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Logisol Mail</p>
            <p className="text-xs text-blue-600">Internal tool</p>
          </div>
        </div>
        {mobile && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
                title="Coming soon"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-blue-100 px-5 py-4">
        <p className="text-xs text-slate-500">Private access only</p>
        <p className="text-xs font-medium text-blue-600">@logisol.tech</p>
      </div>
    </aside>
  );
}
