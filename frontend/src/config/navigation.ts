import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { effectivePermissions } from "@/lib/auth/permissions";
import type { UserOut } from "@/types/user";

/** Permission keys used for sidebar visibility (prefer ``*:view``). */
export type NavScreen = string;

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Exactly one required permission (unless `anyOf` is set). */
  screen?: NavScreen;
  /** User needs at least one of these (e.g. Letters list: view or create). */
  anyOf?: NavScreen[];
};

export const dashboardNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard, screen: "dashboard:view" },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3, screen: "reports:view" },
  {
    title: "Letters",
    href: "/dashboard/letters",
    icon: FileText,
    anyOf: ["letters:view", "letters:create"],
  },
  {
    title: "Approval",
    href: "/dashboard/approval",
    icon: ClipboardCheck,
    screen: "approval:view",
  },
  {
    title: "Assignment",
    href: "/dashboard/assignment",
    icon: UserPlus,
    screen: "assignment:view",
  },
  {
    title: "Consultant",
    href: "/dashboard/consultant",
    icon: Briefcase,
    screen: "consultant:view",
  },
  {
    title: "Closure",
    href: "/dashboard/closure",
    icon: ListChecks,
    screen: "closure:view",
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    screen: "notifications:view",
  },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
    screen: "users:view",
  },
  {
    title: "Role management",
    href: "/dashboard/role-management",
    icon: ShieldCheck,
    screen: "role_management:view",
  },
  {
    title: "Security logs",
    href: "/dashboard/security",
    icon: Shield,
    screen: "security:view",
  },
];

/** Normalize legacy module tokens and ``letters`` → granular keys (matches backend expansion). */
export function expandAllowedScreensKeys(screens: string[]): Set<string> {
  return effectivePermissions({ allowed_screens: screens } as UserOut);
}

export function filterNavForUser(items: NavItem[], user: UserOut | null): NavItem[] {
  if (!user) return [];
  const screens = effectivePermissions(user);
  if (!screens.size) {
    return items.filter(() => false);
  }
  return items.filter((item) => {
    if (item.anyOf?.length) {
      return item.anyOf.some((k) => screens.has(k));
    }
    if (item.screen) return screens.has(item.screen);
    return false;
  });
}
