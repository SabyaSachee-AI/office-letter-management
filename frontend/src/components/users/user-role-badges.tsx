import { Badge } from "@/components/ui/badge";
import type { RoleOut } from "@/types/user";

export function UserRoleBadges({ roles }: { roles: RoleOut[] }) {
  if (!roles.length) {
    return (
      <span className="text-muted-foreground text-xs italic">No roles</span>
    );
  }
  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r.id} variant="secondary" className="text-xs font-normal">
          {r.name}
        </Badge>
      ))}
    </div>
  );
}
