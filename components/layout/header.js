"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{ onMenuClick: () => void }} props
 */
export function Header({ onMenuClick }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-blue-100 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-900">Email Automation</p>
          <p className="text-xs text-slate-500">Logisol internal dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user?.email ? (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{user.email}</p>
            <p className="text-xs text-blue-600">Signed in</p>
          </div>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          loading={loggingOut}
          className="shrink-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
