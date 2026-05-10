import type { UserOut } from "@/types/user";

export function primaryWorkflowRoleLabel(u: UserOut): "Team Leader" | "Consultant" {
  if (u.roles.some((r) => r.name === "Team Leader")) return "Team Leader";
  return "Consultant";
}

export function assignForwardRecipientLabel(u: UserOut): string {
  const role = primaryWorkflowRoleLabel(u);
  const dept = u.department?.name ?? "No department";
  return `${u.full_name} — ${role} — ${dept}`;
}
