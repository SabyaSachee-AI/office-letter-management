"use client";

import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dashboardNav, filterNavForUser } from "@/config/navigation";
import { useAuth } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const linkClass =
  "flex h-9 items-center gap-2 rounded-md px-2 text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white data-[active=true]:border-l-2 data-[active=true]:border-cyan-400 data-[active=true]:bg-cyan-500/20 data-[active=true]:font-medium data-[active=true]:text-white";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  prefsLoaded: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  prefsLoaded,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const items = filterNavForUser(dashboardNav, user);

  const compact = !isMobile && prefsLoaded && collapsed;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const navItems = (
    <nav className="flex flex-col gap-0.5 px-1.5 py-3" aria-label="Dashboard">
      {!compact ? (
        <p className="text-white/50 mb-1 px-2 text-[10px] font-semibold tracking-wider uppercase">
          Menu
        </p>
      ) : null}
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            data-active={active}
            title={compact ? item.title : undefined}
            aria-label={compact ? item.title : undefined}
            onClick={() => onMobileOpenChange(false)}
            className={cn(linkClass, compact && "justify-center px-0")}
          >
            <item.icon className="size-4 shrink-0 text-cyan-200/90" />
            {!compact ? <span>{item.title}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="from-cyan-500 to-cyan-600 flex flex-col bg-gradient-to-r px-3 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <div className={cn("min-w-0", compact && "sr-only")}>
          <span className="font-semibold leading-tight tracking-tight text-white">
            Office Letter Management
          </span>
          <span className="mt-0.5 block text-xs font-medium text-cyan-50/95">
            Integrated tracking &amp; approval
          </span>
        </div>
        {compact ? (
          <span className="text-center text-[10px] font-bold tracking-tight text-white">
            OLM
          </span>
        ) : null}
        {!isMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white hover:bg-white/15 hover:text-white"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const footer = (
    <div className="mt-auto border-t border-white/10 p-2">
      <div className="space-y-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            compact && "justify-center px-0"
          )}
          title={
            user
              ? `${user.full_name} — ${user.email}`
              : undefined
          }
        >
          <Avatar className="size-9 shrink-0 border border-white/20">
            <AvatarFallback className="bg-cyan-600/40 text-xs text-white">
              {user ? initials(user.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          {!compact ? (
            <div className="grid min-w-0 flex-1 text-left text-sm">
              <span className="truncate font-medium text-white">
                {user?.full_name}
              </span>
              <span className="truncate text-xs text-white/70">{user?.email}</span>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon-sm" : "default"}
          title="Log out"
          className={cn(
            "border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white",
            !compact && "h-9 w-full justify-center gap-2"
          )}
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          {!compact ? <span>Log out</span> : null}
        </Button>
      </div>
    </div>
  );

  const chrome = (
    <div className="flex h-full min-h-0 flex-col bg-[#123f63] text-white">
      {brand}
      <div className="min-h-0 flex-1 overflow-y-auto">{navItems}</div>
      {footer}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent
            side="left"
            className="w-72 max-w-[min(18rem,88vw)] border-r border-white/10 bg-[#123f63] p-0 text-white [&>button]:text-white"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Dashboard menu</SheetDescription>
            </SheetHeader>
            {chrome}
          </SheetContent>
        </Sheet>
      ) : null}

      {!isMobile ? (
        <aside
          className={cn(
            "sticky top-0 flex h-svh shrink-0 flex-col border-r border-white/10 bg-[#123f63] text-white transition-[width] duration-200 ease-linear",
            collapsed && prefsLoaded ? "w-20" : "w-72"
          )}
        >
          {chrome}
        </aside>
      ) : null}
    </>
  );
}
