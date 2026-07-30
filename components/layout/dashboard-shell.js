"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          router.push("/login");
          return;
        }
        if (!data.workspace) {
          router.push("/signup?setup=1");
          return;
        }
        if (data.needsOnboarding && !pathname.startsWith("/signup")) {
          router.push("/signup?setup=1");
          return;
        }
        setUserEmail(data.user?.email || "");
        setWorkspace(data.workspace);
        setWorkspaces(data.workspaces || []);
      })
      .catch(() => router.push("/login"));
  }, [router, pathname]);

  async function handleSwitchWorkspace(workspaceId) {
    const res = await fetch("/api/workspaces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) {
      router.refresh();
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

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          userEmail={userEmail}
          workspaceName={workspace?.name}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
