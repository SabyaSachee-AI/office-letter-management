import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "border-emerald-600/35 bg-emerald-500/12 text-emerald-900",
  inactive: "border-slate-400/35 bg-slate-100 text-slate-600",
  suspended: "border-amber-500/40 bg-amber-500/12 text-amber-950",
};

export function UserStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusStyles[key] ?? statusStyles.inactive)}
    >
      {status}
    </Badge>
  );
}
