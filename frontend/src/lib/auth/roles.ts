import type { UserOut } from "@/types/user";

import {
  userHasAnyPermission,
  userHasPermission,
} from "@/lib/auth/permissions";

const SYSTEM_ADMIN = new Set(["System Admin", "Admin"]);const APPROVAL_HEAD = new Set(["Approval Head-PEC", "Approval Head"]);
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
  return userHasPermission(user, "assignment:assign");
}

export function canWorkflowDecide(user: UserOut | null): boolean {
  return (
    isAdmin(user) ||
    userHasAnyPermission(user, [
      "approval:approve",
      "approval:reject",
      "approval:return",
      "approval:route",
    ]) ||
    userHasPermission(user, "assignment:assign")
  );
}

export function canClosure(user: UserOut | null): boolean {
  return userHasPermission(user, "closure:close");
}

export function canViewApprovalQueue(user: UserOut | null): boolean {
  return userHasPermission(user, "approval:view");
}

/** Approve / reject / return / route — show controls when any workflow decision permission exists. */
export function canApprovalActions(user: UserOut | null): boolean {
  return userHasAnyPermission(user, [
    "approval:approve",
    "approval:reject",
    "approval:return",
    "approval:route",
  ]);
}

export function isConsultant(user: UserOut | null): boolean {
  return hasRoleName(user, CONSULTANT);
}

export function isReceivingOfficer(user: UserOut | null): boolean {
  return hasRoleName(user, RECEIVING_OFFICER);
}

export function isApprovalHead(user: UserOut | null): boolean {
  return hasRoleName(user, APPROVAL_HEAD);
}

/** Central inward / approval roles: not scoped by user's department for letter lists. */
export function isCentralLetterRole(user: UserOut | null): boolean {
  return isReceivingOfficer(user) || isApprovalHead(user);
}

/** Primary department for workflow UIs (Team Leader / Consultant may use team_department). */
export function workflowDepartmentId(user: UserOut | null): number | undefined {
  if (!user) return undefined;
  return user.department?.id ?? user.team_department?.id ?? undefined;
}
