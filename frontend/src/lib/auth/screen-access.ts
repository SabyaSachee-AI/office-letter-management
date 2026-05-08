import { expandAllowedScreensKeys } from "@/config/navigation";

/**
 * Route protection aligned with backend permission keys.
 * Letter detail: `letters:view` or consultant module access.
 * Receive letter: `letters:create` only.
 */
export function pathRequiresScreens(pathname: string): string[] | null {
  if (pathname.startsWith("/dashboard/access-denied")) return null;
  if (pathname === "/dashboard") return ["dashboard:view"];
  if (pathname.startsWith("/dashboard/reports")) return ["reports:view"];
  if (pathname.startsWith("/dashboard/approval")) return ["approval:view"];
  if (pathname.startsWith("/dashboard/assignment")) return ["assignment:view"];
  if (pathname.startsWith("/dashboard/consultant")) return ["consultant:view"];
  if (pathname.startsWith("/dashboard/closure")) return ["closure:view"];
  if (pathname.startsWith("/dashboard/notifications")) return ["notifications:view"];
  if (pathname.startsWith("/dashboard/users")) return ["users:view"];
  if (pathname.startsWith("/dashboard/role-management")) return ["role_management:view"];
  if (pathname.startsWith("/dashboard/security")) return ["security:view"];
  if (pathname.startsWith("/dashboard/letters/receive")) {
    return ["letters:create"];
  }
  // Letter detail (assigned consultants may open without letters:view)
  if (/^\/dashboard\/letters\/\d+(?:\/|$)/.test(pathname)) {
    return ["letters:view", "letters:create", "consultant:view"];
  }
  // Letters list / browse — not the main consultant entry point
  if (pathname === "/dashboard/letters" || pathname.startsWith("/dashboard/letters?")) {
    return ["letters:view", "letters:create"];
  }
  if (pathname.startsWith("/dashboard")) return ["dashboard:view"];
  return null;
}

export function canAccessPath(pathname: string, allowedScreens: string[]): boolean {
  const req = pathRequiresScreens(pathname);
  if (req === null) return true;
  const have = expandAllowedScreensKeys(allowedScreens);
  return req.some((k) => have.has(k));
}
