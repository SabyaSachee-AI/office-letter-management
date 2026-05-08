/** Client-side slug aligned with backend ``derive_role_code_from_name`` (uppercase, underscores). */
export function deriveRoleCodeFromName(name: string): string {
  const raw = name
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/gu, "_");
  let code = raw.toUpperCase().replace(/[^A-Z0-9_]/gu, "_").replace(/^_+|_+$/gu, "");
  if (!code) return "";
  if (/^\d/.test(code)) code = `R_${code}`;
  return code.slice(0, 40);
}
