"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { fetchJson, queryKeys } from "@/lib/query";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sessionQuery = useQuery({
    queryKey: queryKeys.session(),
    queryFn: () => fetchJson("/api/auth/session"),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (sessionQuery.isError && !sessionQuery.data?.workspace) {
      router.push("/login");
      return;
    }

    const data = sessionQuery.data;
    if (!data) return;

    if (!data.workspace) {
      router.push("/signup?setup=1");
      return;
    }

    if (data.needsOnboarding && !pathname.startsWith("/signup")) {
      router.push("/signup?setup=1");
    }
  }, [sessionQuery.isError, sessionQuery.data, router, pathname]);

  const userEmail = sessionQuery.data?.user?.email || "";
  const workspace = sessionQuery.data?.workspace || null;
  const workspaces = sessionQuery.data?.workspaces || [];

  async function handleSwitchWorkspace(workspaceId) {
    const res = await fetch("/api/workspaces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) {
      queryClient.clear();
      window.location.href = "/";
    }
  }

  return (
    <div className="ps-page relative flex min-h-screen">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64">
        <Sidebar
          workspace={workspace}
          workspaces={workspaces}
          onSwitchWorkspace={handleSwitchWorkspace}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,20rem)] shadow-xl">
            <Sidebar
              mobile
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              workspace={workspace}
              workspaces={workspaces}
              onSwitchWorkspace={handleSwitchWorkspace}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          userEmail={userEmail}
          workspaceName={workspace?.name}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
