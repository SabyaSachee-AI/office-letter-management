import type { AssignmentOut } from "@/types/letter";
import { AssignmentStatusBadge } from "@/components/letters/letter-badges";

type Dept = { name: string; code: string } | null | undefined;

type AssignmentRecipientSummaryProps = {
  assignment: AssignmentOut;
  /** Letter’s routed department (from Approval Head-PEC), if known */
  letterDepartment?: Dept;
  /** Latest Team Leader / forward comment for this assignment chain */
  teamLeaderComment?: string | null;
};

export function AssignmentRecipientSummary({
  assignment,
  letterDepartment,
  teamLeaderComment,
}: AssignmentRecipientSummaryProps) {
  const c = assignment.consultant_user;
  const by = assignment.assigned_by_user;
  const assignedLine = c
    ? `${c.full_name} — ${c.roles.join(", ")} — ${c.department?.name ?? "—"}`
    : `User #${assignment.consultant_id}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-800 shadow-sm">
      <p className="font-semibold text-[#123f63]">Current assignment</p>
      {letterDepartment ? (
        <p className="mt-1.5">
          <span className="font-medium text-slate-700">Assigned department (letter): </span>
          {letterDepartment.name} ({letterDepartment.code})
        </p>
      ) : null}
      <p className="mt-1.5">
        <span className="font-medium text-slate-700">Assigned to: </span>
        {assignedLine}
      </p>
      <p className="mt-1">
        <span className="font-medium text-slate-700">Assigned by: </span>
        {by
          ? `${by.full_name} — ${by.roles.join(", ")}`
          : `User #${assignment.assigned_by}`}
      </p>
      <p className="mt-1">
        <span className="font-medium text-slate-700">Assigned time: </span>
        {new Date(assignment.assigned_at).toLocaleString()}
      </p>
      {teamLeaderComment?.trim() ? (
        <p className="mt-2 whitespace-pre-wrap border-t border-slate-200/90 pt-2 text-slate-700">
          <span className="font-medium text-slate-800">Team Leader note: </span>
          {teamLeaderComment}
        </p>
      ) : null}
      <p className="mt-2">
        <span className="font-medium text-slate-700">Current assignment status: </span>
        <AssignmentStatusBadge status={assignment.work_status} />
      </p>
    </div>
  );
}
