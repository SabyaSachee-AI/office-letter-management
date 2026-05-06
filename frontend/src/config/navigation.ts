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

import type { UserOut } from "@/types/user";

/** Backend screen keys from `GET /users/me` → `allowed_screens`. */
export type NavScreen =
  | "dashboard"
  | "letters:view"
  | "letters:create"
  | "approval"
  | "assignment"
  | "consultant"
  | "closure"
  | "reports"
  | "users"
  | "notifications"
  | "security"
  | "role_management";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Exactly one required screen (unless `anyOf` is set). */
  screen?: NavScreen;
  /** User needs at least one of these (e.g. Letters list: view or create). */
  anyOf?: NavScreen[];
};

export const dashboardNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3, screen: "reports" },
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
    screen: "approval",
  },
  {
    title: "Assignment",
    href: "/dashboard/assignment",
    icon: UserPlus,
    screen: "assignment",
  },
  {
    title: "Consultant",
    href: "/dashboard/consultant",
    icon: Briefcase,
    screen: "consultant",
  },
  {
    title: "Closure",
    href: "/dashboard/closure",
    icon: ListChecks,
    screen: "closure",
  },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell, screen: "notifications" },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
    screen: "users",
  },
  {
    title: "Role management",
    href: "/dashboard/role-management",
    icon: ShieldCheck,
    screen: "role_management",
  },
  {
    title: "Security logs",
    href: "/dashboard/security",
    icon: Shield,
    screen: "security",
  },
];

/** Normalize legacy `letters` permission from older APIs. */
export function expandAllowedScreensKeys(screens: string[]): Set<string> {
  const s = new Set(screens);
  if (s.has("letters")) {
    s.add("letters:view");
    s.add("letters:create");
  }
  return s;
}

export function filterNavForUser(items: NavItem[], user: UserOut | null): NavItem[] {
  if (!user) return [];
  const screens = expandAllowedScreensKeys(user.allowed_screens ?? []);
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
