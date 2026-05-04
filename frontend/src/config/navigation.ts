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
  UserPlus,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** User must have at least one of these role names (API uses title case). Omit for all authenticated users. */
  roles?: string[];
};

export const dashboardNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { title: "Letters", href: "/dashboard/letters", icon: FileText },
  {
    title: "Approval",
    href: "/dashboard/approval",
    icon: ClipboardCheck,
    roles: ["Admin", "Approval Head", "Team Leader", "Receiving Officer"],
  },
  {
    title: "Assignment",
    href: "/dashboard/assignment",
    icon: UserPlus,
    roles: ["Admin", "Team Leader"],
  },
  {
    title: "Consultant",
    href: "/dashboard/consultant",
    icon: Briefcase,
    roles: ["Consultant"],
  },
  {
    title: "Closure",
    href: "/dashboard/closure",
    icon: ListChecks,
    roles: ["Admin", "Approval Head", "Team Leader"],
  },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["Admin", "Approval Head", "Team Leader"],
  },
  {
    title: "Security logs",
    href: "/dashboard/security",
    icon: Shield,
    roles: ["Admin"],
  },
];

export function filterNavByRoles(
  items: NavItem[],
  roleNames: Set<string>
): NavItem[] {
  return items.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.some((r) => roleNames.has(r));
  });
}
