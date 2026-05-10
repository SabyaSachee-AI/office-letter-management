"use client";

import { ChevronsLeft, ChevronsRight, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ScreenGuard } from "@/components/dashboard/screen-guard";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { FullPageLoading } from "@/components/layout/full-page-loading";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { userHasPermission } from "@/lib/auth/permissions";

const SIDEBAR_COLLAPSED_KEY = "olm-dashboard-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPrefsLoaded, setSidebarPrefsLoaded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
    setSidebarPrefsLoaded(true);
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return <FullPageLoading message="Loading…" />;
  }

  return (
    <div className="olm-dashboard flex min-h-screen w-full flex-row items-stretch bg-white">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        prefsLoaded={sidebarPrefsLoaded}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto">
        <header className="border-border bg-slate-100/95 flex h-14 min-h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#123f63] hover:bg-slate-200/80 -ml-1 shrink-0 md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#123f63] hover:bg-slate-200/80 -ml-1 hidden shrink-0 md:inline-flex"
            onClick={toggleSidebarCollapsed}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="size-5" />
            ) : (
              <ChevronsLeft className="size-5" />
            )}
          </Button>
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground hidden text-xs font-medium uppercase tracking-wide sm:block">
              Office Letter Management
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userHasPermission(user, "notifications:view") ? <NotificationBell /> : null}
            <span className="text-foreground hidden max-w-[200px] truncate text-sm font-medium md:inline">
              {user.full_name}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#123f63]/25 text-[#123f63] hover:bg-[#123f63]/10"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 p-6 max-w-full">
          <ScreenGuard>{children}</ScreenGuard>
        </div>
      </div>
    </div>
  );
}
