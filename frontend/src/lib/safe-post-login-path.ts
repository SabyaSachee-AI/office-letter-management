/**
 * Returns a same-origin path for post-login redirect. Rejects protocol-relative
 * and other non-path values (e.g. `//evil.com` still starts with `/` in JS).
 */
export function safePostLoginPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
