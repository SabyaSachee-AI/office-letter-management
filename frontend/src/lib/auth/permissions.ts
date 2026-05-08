import type { UserOut } from "@/types/user";

/** Mirrors backend ``LEGACY_MODULE_IMPLIED_PERMISSIONS`` for offline/cached sessions. */
const LEGACY_MODULE_IMPLIED: Record<string, readonly string[]> = {
  dashboard: ["dashboard:view"],
  approval: [
    "approval:view",
    "approval:approve",
    "approval:reject",
    "approval:return",
    "approval:route",
  ],
  assignment: ["assignment:view", "assignment:assign", "assignment:reassign"],
  consultant: [
    "consultant:view",
    "consultant:update",
    "consultant:resolve",
    "consultant:transfer",
    "consultant:upload",
  ],
  closure: ["closure:view", "closure:review", "closure:close"],
  reports: ["reports:view", "reports:export"],
  users: ["users:view", "users:create", "users:update", "users:delete"],
  notifications: ["notifications:view"],
  security: ["security:view"],
  role_management: ["role_management:view"],
};

function expandLegacyLetters(keys: Set<string>): void {
  if (keys.has("letters")) {
    keys.delete("letters");
    keys.add("letters:view");
    keys.add("letters:create");
  }
}

/** Effective permission strings for UI checks (legacy modules expanded). */
export function effectivePermissions(user: UserOut | null): Set<string> {
  const raw = new Set(user?.allowed_screens ?? []);
  expandLegacyLetters(raw);
  const out = new Set(raw);
  for (const k of raw) {
    const implied = LEGACY_MODULE_IMPLIED[k];
    if (implied) {
      for (const p of implied) out.add(p);
    }
  }
  return out;
}

export function userHasPermission(user: UserOut | null, key: string): boolean {
  return effectivePermissions(user).has(key);
}

export function userHasAnyPermission(user: UserOut | null, keys: readonly string[]): boolean {
  const eff = effectivePermissions(user);
  return keys.some((k) => eff.has(k));
}
