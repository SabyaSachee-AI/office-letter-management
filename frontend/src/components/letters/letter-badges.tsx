import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LetterPriority, LetterStatus } from "@/types/letter";

const statusClass: Partial<Record<LetterStatus, string>> = {
  received: "border-[#123f63]/25 bg-[#123f63]/10 text-[#123f63]",
  under_review: "border-cyan-600/35 bg-cyan-500/15 text-cyan-900",
  returned_for_correction:
    "border-amber-500/35 bg-amber-500/12 text-amber-950",
  rejected: "border-red-500/35 bg-red-500/10 text-red-800",
  processed: "border-emerald-600/35 bg-emerald-500/12 text-emerald-900",
  closed: "border-slate-400/30 bg-slate-500/10 text-slate-700",
};

const priorityClass: Record<LetterPriority, string> = {
  low: "border-slate-400/35 bg-slate-500/5 text-slate-700",
  normal: "border-[#123f63]/25 bg-[#123f63]/8 text-[#123f63]",
  high: "border-amber-500/45 bg-amber-500/12 text-amber-950",
  urgent: "border-red-500/45 bg-red-500/10 text-red-800",
};

export function LetterStatusBadge({ status }: { status: LetterStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusClass[status] ?? "")}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function LetterPriorityBadge({ priority }: { priority: LetterPriority }) {
  return (
    <Badge variant="outline" className={cn("capitalize", priorityClass[priority])}>
      {priority}
    </Badge>
  );
}
