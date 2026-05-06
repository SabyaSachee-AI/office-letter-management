import { expandAllowedScreensKeys } from "@/config/navigation";

/**
 * Route protection aligned with backend screen keys.
 * Letter detail: `letters:view` or `consultant` (assigned work).
 * Receive letter: `letters:create` only.
 */
export function pathRequiresScreens(pathname: string): string[] | null {
  if (pathname.startsWith("/dashboard/access-denied")) return null;
  if (pathname === "/dashboard") return ["dashboard"];
  if (pathname.startsWith("/dashboard/reports")) return ["reports"];
  if (pathname.startsWith("/dashboard/approval")) return ["approval"];
  if (pathname.startsWith("/dashboard/assignment")) return ["assignment"];
  if (pathname.startsWith("/dashboard/consultant")) return ["consultant"];
  if (pathname.startsWith("/dashboard/closure")) return ["closure"];
  if (pathname.startsWith("/dashboard/notifications")) return ["notifications"];
  if (pathname.startsWith("/dashboard/users")) return ["users"];
  if (pathname.startsWith("/dashboard/role-management")) return ["role_management"];
  if (pathname.startsWith("/dashboard/security")) return ["security"];
  if (pathname.startsWith("/dashboard/letters/receive")) {
    return ["letters:create"];
  }
  // Letter detail (assigned consultants may open without letters:view)
  if (/^\/dashboard\/letters\/\d+(?:\/|$)/.test(pathname)) {
    return ["letters:view", "letters:create", "consultant"];
  }
  // Letters list / browse — not the main consultant entry point
  if (pathname === "/dashboard/letters" || pathname.startsWith("/dashboard/letters?")) {
    return ["letters:view", "letters:create"];
  }
  if (pathname.startsWith("/dashboard")) return ["dashboard"];
  return null;
}

export function canAccessPath(pathname: string, allowedScreens: string[]): boolean {
  const req = pathRequiresScreens(pathname);
  if (req === null) return true;
  const have = expandAllowedScreensKeys(allowedScreens);
  return req.some((k) => have.has(k));
}
