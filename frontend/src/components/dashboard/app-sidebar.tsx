"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { dashboardNav, filterNavByRoles } from "@/config/navigation";
import { useAuth } from "@/context/auth-context";
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

const menuButtonClass =
  "h-9 text-white/90 hover:bg-white/10 hover:text-white data-[active=true]:border-l-2 data-[active=true]:border-cyan-400 data-[active=true]:bg-cyan-500/20 data-[active=true]:text-white data-[active=true]:font-medium";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const roleNames = new Set(user?.roles.map((r) => r.name) ?? []);
  const items = filterNavByRoles(dashboardNav, roleNames);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      className={cn(
        "w-64 shrink-0 border-r border-white/10 text-white",
        "[&_[data-sidebar=sidebar]]:bg-[#123f63]"
      )}
    >
      <SidebarHeader className="border-0 p-0">
        <div className="from-cyan-500 to-cyan-600 flex flex-col bg-gradient-to-r px-3 py-3.5 shadow-sm">
          <span className="font-semibold leading-tight tracking-tight text-white">
            Office Letter Management
          </span>
          <span className="text-xs font-medium text-cyan-50/95">
            Integrated tracking &amp; approval
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1.5 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-white/50 uppercase">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)
                    }
                    tooltip={item.title}
                    className={menuButtonClass}
                    render={<Link href={item.href} prefetch />}
                  >
                    <item.icon className="size-4 shrink-0 text-cyan-200/90" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-white/10 p-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <Avatar className="size-9 border border-white/20">
              <AvatarFallback className="bg-cyan-600/40 text-xs text-white">
                {user ? initials(user.full_name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm">
              <span className="truncate font-medium text-white">
                {user?.full_name}
              </span>
              <span className="truncate text-xs text-white/70">{user?.email}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-center gap-2 border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
