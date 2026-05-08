import type {
  AssignmentOut,
  AssignmentWorkStatus,
  LetterOut,
  LetterStatus,
} from "@/types/letter";

type BadgeTone = string;

export const LETTER_STATUS_LABELS: Record<LetterStatus, string> = {
  received: "Received & Pending Approval",
  under_review: "Forwarded to Department",
  processed: "Forwarded to Department",
  returned_for_correction: "Returned for Correction",
  rejected: "Rejected",
  closed: "Officially Closed",
};

export const ASSIGNMENT_WORK_STATUS_LABELS: Record<AssignmentWorkStatus, string> = {
  assigned: "Assigned to Consultant",
  in_progress: "Under Investigation",
  resolved: "Solution Submitted",
  transferred: "Reassigned for Further Action",
};

export type VisibleWorkflowStatusKey =
  | "received_pending_approval"
  | "forwarded_to_department"
  | "assigned_to_consultant"
  | "under_investigation"
  | "solution_submitted"
  | "pending_final_closure"
  | "officially_closed"
  | "returned_for_correction"
  | "rejected"
  | "reassigned_for_further_action";

const VISIBLE_STATUS_BADGE_TONES: Record<VisibleWorkflowStatusKey, BadgeTone> = {
  received_pending_approval: "border-orange-500/35 bg-orange-500/12 text-orange-900",
  forwarded_to_department: "border-blue-500/35 bg-blue-500/12 text-blue-900",
  assigned_to_consultant: "border-purple-500/35 bg-purple-500/12 text-purple-900",
  under_investigation: "border-yellow-500/40 bg-yellow-500/12 text-yellow-900",
  solution_submitted: "border-cyan-500/40 bg-cyan-500/12 text-cyan-900",
  pending_final_closure: "border-indigo-500/35 bg-indigo-500/12 text-indigo-900",
  officially_closed: "border-emerald-500/35 bg-emerald-500/12 text-emerald-900",
  returned_for_correction: "border-slate-400/35 bg-slate-500/10 text-slate-700",
  rejected: "border-red-500/35 bg-red-500/10 text-red-800",
  reassigned_for_further_action: "border-teal-500/40 bg-teal-500/12 text-teal-900",
};

export type VisibleWorkflowStatus = {
  internalStatus: string;
  visibleLabel: string;
  description: string;
  color: string;
  currentHolderLabel: string;
  stageKey: VisibleWorkflowStatusKey;
};

type MinimalLetter = Pick<LetterOut, "status" | "department">;
type MinimalAssignment = Pick<
  AssignmentOut,
  "work_status" | "consultant_user" | "resolution_note" | "has_solution_file"
>;

function departmentForwardLabel(departmentName?: string | null): string {
  const n = (departmentName ?? "").trim();
  if (!n) return "Forwarded to Department";
  return `Forwarded to ${n}`;
}

function consultantHolder(assignment?: MinimalAssignment | null): string {
  const who = assignment?.consultant_user?.full_name?.trim();
  const dept = assignment?.consultant_user?.department?.name?.trim();
  if (!who) return "Assigned Consultant";
  return dept ? `${who} - Consultant - ${dept}` : `${who} - Consultant`;
}

export function getVisibleWorkflowStatus(
  letter: MinimalLetter,
  latestAssignment?: MinimalAssignment | null,
  options?: { preferPendingFinalClosure?: boolean }
): VisibleWorkflowStatus {
  const hasClosureEvidence = Boolean(
    latestAssignment &&
      (latestAssignment.work_status === "resolved" ||
        (latestAssignment.resolution_note ?? "").trim() ||
        latestAssignment.has_solution_file)
  );
  const internalStatus = latestAssignment
    ? `${letter.status}:${latestAssignment.work_status}`
    : letter.status;

  if (letter.status === "closed") {
    return {
      internalStatus,
      visibleLabel: "Officially Closed",
      description: "Letter lifecycle is completed.",
      color: VISIBLE_STATUS_BADGE_TONES.officially_closed,
      currentHolderLabel: "Completed",
      stageKey: "officially_closed",
    };
  }

  if (letter.status === "rejected") {
    return {
      internalStatus,
      visibleLabel: "Rejected",
      description: "Letter was rejected during approval workflow.",
      color: VISIBLE_STATUS_BADGE_TONES.rejected,
      currentHolderLabel: "Approval Head-PEC",
      stageKey: "rejected",
    };
  }

  if (letter.status === "returned_for_correction") {
    return {
      internalStatus,
      visibleLabel: "Returned for Correction",
      description: "Letter requires correction before workflow can continue.",
      color: VISIBLE_STATUS_BADGE_TONES.returned_for_correction,
      currentHolderLabel: "Approval Head-PEC",
      stageKey: "returned_for_correction",
    };
  }

  if (latestAssignment?.work_status === "transferred") {
    return {
      internalStatus,
      visibleLabel: "Reassigned for Further Action",
      description: "Assignment has been transferred to another consultant.",
      color: VISIBLE_STATUS_BADGE_TONES.reassigned_for_further_action,
      currentHolderLabel: "Concern Department / Team Leader",
      stageKey: "reassigned_for_further_action",
    };
  }

  if (latestAssignment?.work_status === "in_progress") {
    return {
      internalStatus,
      visibleLabel: "Under Investigation",
      description: "Consultant has started working on this letter.",
      color: VISIBLE_STATUS_BADGE_TONES.under_investigation,
      currentHolderLabel: consultantHolder(latestAssignment),
      stageKey: "under_investigation",
    };
  }

  if (latestAssignment?.work_status === "assigned") {
    return {
      internalStatus,
      visibleLabel: "Assigned to Consultant",
      description: "Team Leader has assigned the letter for processing.",
      color: VISIBLE_STATUS_BADGE_TONES.assigned_to_consultant,
      currentHolderLabel: consultantHolder(latestAssignment),
      stageKey: "assigned_to_consultant",
    };
  }

  if (latestAssignment?.work_status === "resolved" || (options?.preferPendingFinalClosure && hasClosureEvidence)) {
    const preferFinal = options?.preferPendingFinalClosure ?? false;
    return {
      internalStatus,
      visibleLabel: preferFinal ? "Pending Final Closure" : "Solution Submitted",
      description: preferFinal
        ? "Solution submitted and waiting for final closure review."
        : "Consultant submitted solution and remarks.",
      color: preferFinal
        ? VISIBLE_STATUS_BADGE_TONES.pending_final_closure
        : VISIBLE_STATUS_BADGE_TONES.solution_submitted,
      currentHolderLabel: "Team Leader / Final Reviewer",
      stageKey: preferFinal ? "pending_final_closure" : "solution_submitted",
    };
  }

  if (letter.status === "received") {
    return {
      internalStatus,
      visibleLabel: "Received & Pending Approval",
      description: "Letter is waiting for Approval Head-PEC review.",
      color: VISIBLE_STATUS_BADGE_TONES.received_pending_approval,
      currentHolderLabel: "Approval Head-PEC",
      stageKey: "received_pending_approval",
    };
  }

  if (letter.status === "processed" || letter.status === "under_review") {
    return {
      internalStatus,
      visibleLabel: departmentForwardLabel(letter.department?.name),
      description: "PEC has forwarded this letter to the concerned department.",
      color: VISIBLE_STATUS_BADGE_TONES.forwarded_to_department,
      currentHolderLabel: letter.department?.name
        ? `${letter.department.name} Team Leader`
        : "Concern Department / Team Leader",
      stageKey: "forwarded_to_department",
    };
  }

  return {
    internalStatus,
    visibleLabel: "Forwarded to Department",
    description: "Letter is currently in department workflow.",
    color: VISIBLE_STATUS_BADGE_TONES.forwarded_to_department,
    currentHolderLabel: "Concern Department / Team Leader",
    stageKey: "forwarded_to_department",
  };
}

export function getLetterStatusLabel(status: LetterStatus): string {
  return getVisibleWorkflowStatus({ status, department: null }).visibleLabel;
}

export function getAssignmentWorkStatusLabel(status: AssignmentWorkStatus): string {
  if (status === "resolved") return "Solution Submitted";
  return ASSIGNMENT_WORK_STATUS_LABELS[status];
}

export function getLetterStatusBadgeTone(status: LetterStatus): string {
  return getVisibleWorkflowStatus({ status, department: null }).color;
}

export function getAssignmentStatusBadgeTone(status: AssignmentWorkStatus): string {
  if (status === "assigned") return VISIBLE_STATUS_BADGE_TONES.assigned_to_consultant;
  if (status === "in_progress") return VISIBLE_STATUS_BADGE_TONES.under_investigation;
  if (status === "resolved") return VISIBLE_STATUS_BADGE_TONES.solution_submitted;
  return VISIBLE_STATUS_BADGE_TONES.reassigned_for_further_action;
}

export function getCombinedWorkflowDisplayLabel(
  letterStatus: LetterStatus,
  assignmentStatus?: AssignmentWorkStatus | null
): string {
  return getVisibleWorkflowStatus(
    { status: letterStatus, department: null },
    assignmentStatus ? ({ work_status: assignmentStatus } as MinimalAssignment) : null
  ).visibleLabel;
}

export function getVisibleWorkflowColor(stageKey: VisibleWorkflowStatusKey): string {
  return VISIBLE_STATUS_BADGE_TONES[stageKey];
}

export const APPROVAL_QUEUE_STATUS_OPTIONS = [
  { value: "received", label: "Received & Pending Approval" },
] as const;

export const ASSIGNMENT_QUEUE_STATUS_OPTIONS = [
  { value: "processed", label: "Forwarded to Department" },
  { value: "under_review", label: "Forwarded to Department" },
] as const;

export const LETTER_STATUS_FILTER_OPTIONS = [
  { value: "received", label: "Received & Pending Approval" },
  { value: "under_review", label: "Forwarded to Department" },
  { value: "returned_for_correction", label: "Returned for Correction" },
  { value: "rejected", label: "Rejected" },
  { value: "processed", label: "Forwarded to Department" },
  { value: "closed", label: "Officially Closed" },
] as const;

export const ASSIGNMENT_STATUS_FILTER_OPTIONS = [
  { value: "assigned", label: "Assigned to Consultant" },
  { value: "in_progress", label: "Under Investigation" },
  { value: "resolved", label: "Solution Submitted" },
  { value: "transferred", label: "Reassigned for Further Action" },
] as const;
