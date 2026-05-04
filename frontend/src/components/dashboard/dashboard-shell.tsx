"use client";

import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { FullPageLoading } from "@/components/layout/full-page-loading";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
    }
  }, [loading, user, router, pathname]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return <FullPageLoading message="Loading…" />;
  }

  return (
    <SidebarProvider className="olm-dashboard flex min-h-screen w-full">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto bg-white">
        <header className="border-border bg-slate-100/95 flex h-14 min-h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm">
          <SidebarTrigger className="text-[#123f63] hover:bg-slate-200/80 -ml-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground hidden text-xs font-medium uppercase tracking-wide sm:block">
              Office Letter Management
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
