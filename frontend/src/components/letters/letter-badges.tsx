import { Badge } from "@/components/ui/badge";
import {
  getCombinedWorkflowDisplayLabel,
  getAssignmentStatusBadgeTone,
  getAssignmentWorkStatusLabel,
  getLetterStatusBadgeTone,
  getLetterStatusLabel,
  getVisibleWorkflowStatus,
} from "@/lib/workflow-display";
import { cn } from "@/lib/utils";
import type {
  AssignmentOut,
  AssignmentWorkStatus,
  LetterOut,
  LetterPriority,
  LetterStatus,
} from "@/types/letter";

const priorityClass: Record<LetterPriority, string> = {
  low: "border-slate-400/35 bg-slate-500/5 text-slate-700",
  normal: "border-[#123f63]/25 bg-[#123f63]/8 text-[#123f63]",
  high: "border-amber-500/45 bg-amber-500/12 text-amber-950",
  urgent: "border-red-500/45 bg-red-500/10 text-red-800",
};

export function LetterStatusBadge({ status }: { status: LetterStatus }) {
  return (
    <Badge variant="outline" className={cn(getLetterStatusBadgeTone(status))}>
      {getLetterStatusLabel(status)}
    </Badge>
  );
}

export function AssignmentStatusBadge({ status }: { status: AssignmentWorkStatus }) {
  return (
    <Badge variant="outline" className={cn(getAssignmentStatusBadgeTone(status))}>
      {getAssignmentWorkStatusLabel(status)}
    </Badge>
  );
}

export function VisibleWorkflowStatusBadge({
  letter,
  latestAssignment,
  preferPendingFinalClosure = false,
}: {
  letter: Pick<LetterOut, "status" | "department">;
  latestAssignment?: Pick<
    AssignmentOut,
    "work_status" | "consultant_user" | "resolution_note" | "has_solution_file"
  > | null;
  preferPendingFinalClosure?: boolean;
}) {
  const visible = getVisibleWorkflowStatus(letter, latestAssignment, {
    preferPendingFinalClosure,
  });
  return (
    <Badge variant="outline" className={cn(visible.color)} title={visible.description}>
      {visible.visibleLabel}
    </Badge>
  );
}

export function CombinedWorkflowText({
  letterStatus,
  assignmentStatus,
}: {
  letterStatus: LetterStatus;
  assignmentStatus?: AssignmentWorkStatus | null;
}) {
  return getCombinedWorkflowDisplayLabel(letterStatus, assignmentStatus);
}

export function LetterPriorityBadge({ priority }: { priority: LetterPriority }) {
  return (
    <Badge variant="outline" className={cn("capitalize", priorityClass[priority])}>
      {priority}
    </Badge>
  );
}
