import type { UserOut } from "@/types/user";

const SYSTEM_ADMIN = new Set(["System Admin", "Admin"]);
const APPROVAL_HEAD = new Set(["Approval Head-PEC", "Approval Head"]);
const TEAM_LEADER = new Set(["Team Leader"]);
const CONSULTANT = new Set(["Consultant"]);
const RECEIVING_OFFICER = new Set(["Receiving Officer"]);

export function roleNames(user: UserOut | null): Set<string> {
  return new Set(user?.roles.map((r) => r.name) ?? []);
}

export function hasRoleName(user: UserOut | null, canonicalNames: Set<string>): boolean {
  const names = roleNames(user);
  for (const n of names) {
    if (canonicalNames.has(n)) return true;
  }
  return false;
}

export function hasRole(user: UserOut | null, roleName: string): boolean {
  return user?.roles.some((r) => r.name === roleName) ?? false;
}

export function isAdmin(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN);
}

export function isSystemAdmin(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN);
}

export function canAssignConsultant(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN) || hasRoleName(user, TEAM_LEADER);
}

export function canWorkflowDecide(user: UserOut | null): boolean {
  return (
    hasRoleName(user, SYSTEM_ADMIN) ||
    hasRoleName(user, APPROVAL_HEAD) ||
    hasRoleName(user, TEAM_LEADER)
  );
}

export function canClosure(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN) || hasRoleName(user, TEAM_LEADER);
}

export function canViewApprovalQueue(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN) || hasRoleName(user, APPROVAL_HEAD);
}

/** Approve / reject / return / route (PEC approval actors only). */
export function canApprovalActions(user: UserOut | null): boolean {
  return hasRoleName(user, SYSTEM_ADMIN) || hasRoleName(user, APPROVAL_HEAD);
}

export function isConsultant(user: UserOut | null): boolean {
  return hasRoleName(user, CONSULTANT);
}

export function isReceivingOfficer(user: UserOut | null): boolean {
  return hasRoleName(user, RECEIVING_OFFICER);
}
