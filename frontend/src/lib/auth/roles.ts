import type { UserOut } from "@/types/user";

export function hasRole(user: UserOut | null, roleName: string): boolean {
  return user?.roles.some((r) => r.name === roleName) ?? false;
}

export function isAdmin(user: UserOut | null): boolean {
  return hasRole(user, "Admin");
}

export function canAssignConsultant(user: UserOut | null): boolean {
  return hasRole(user, "Admin") || hasRole(user, "Team Leader");
}

export function canWorkflowDecide(user: UserOut | null): boolean {
  return (
    hasRole(user, "Admin") ||
    hasRole(user, "Approval Head") ||
    hasRole(user, "Team Leader")
  );
}

export function canClosure(user: UserOut | null): boolean {
  return canWorkflowDecide(user);
}

export function canViewApprovalQueue(user: UserOut | null): boolean {
  return (
    hasRole(user, "Admin") ||
    hasRole(user, "Approval Head") ||
    hasRole(user, "Team Leader") ||
    hasRole(user, "Receiving Officer")
  );
}
