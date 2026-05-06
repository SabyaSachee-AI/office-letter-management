"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TeamLeaderAssignmentPanel } from "@/components/assignments/team-leader-assignment-panel";
import { ClosurePanel } from "@/components/closure/closure-panel";
import { ConsultantAssignmentWork } from "@/components/consultant/consultant-assignment-work";
import { ErrorBanner } from "@/components/data/error-banner";
import { AssignmentRecipientSummary } from "@/components/letters/assignment-recipient-summary";
import { LetterAttachmentPreviewPane } from "@/components/letters/letter-attachment-preview-pane";
import { LetterCompactSummary } from "@/components/letters/letter-compact-summary";
import { LetterStatusTimeline } from "@/components/letters/letter-status-timeline";
import { WorkflowCommentBlocks } from "@/components/letters/letter-workflow-comment-blocks";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAssignmentTracking } from "@/lib/api/assignments";
import {
  deleteLetterAdmin,
  getLetter,
  getLetterActionHistory,
  updateLetterAdmin,
} from "@/lib/api/letters";
import { approveLetter, rejectLetter } from "@/lib/api/workflow";
import { fetchDepartments } from "@/lib/api/users";
import {
  canApprovalActions,
  canAssignConsultant,
  canClosure,
  hasRole,
  isAdmin,
  isReceivingOfficer,
  workflowDepartmentId,
} from "@/lib/auth/roles";
import {
  buildConsultantSolutionSummary,
  consultantWorkReadyForClosure,
  lastTeamLeaderAssignmentAction,
} from "@/lib/letter-workflow";
import { cn } from "@/lib/utils";
import { toastError, toastSuccess } from "@/lib/toast";
import type { AssignmentOut, ClosureHistoryResponse, LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

type LetterDetailViewProps = {
  letterId: number;
};

export function LetterDetailView({ letterId }: LetterDetailViewProps) {
  const { user: me } = useAuth();
  const [letter, setLetter] = useState<LetterOut | null>(null);
  const [history, setHistory] = useState<ClosureHistoryResponse | null>(null);
  const [assignments, setAssignments] = useState<AssignmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [memoNo, setMemoNo] = useState("");
  const [subject, setSubject] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [approvalNote, setApprovalNote] = useState("");
  const [approvalDepartmentId, setApprovalDepartmentId] = useState("");
  const [approvalPriority, setApprovalPriority] = useState<"low" | "normal" | "high" | "urgent">(
    "normal"
  );
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [approvalPending, setApprovalPending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [l, h, t] = await Promise.all([
        getLetter(letterId),
        getLetterActionHistory(letterId),
        getAssignmentTracking(letterId).catch(() => null),
      ]);
      setLetter(l);
      setMemoNo(l.memo_no ?? "");
      setSubject(l.subject);
      setReceivedFrom(l.received_from);
      setPriority(l.priority);
      setHistory(h);
      setAssignments(t?.assignments ?? []);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setLetter(null);
      setHistory(null);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#closure") {
      document.getElementById("closure")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [letter]);

  useEffect(() => {
    if (!canApprovalActions(me)) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchDepartments({ excludeLegacy: true });
        if (!cancelled) setDepartments(items);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const consultantSolutionSummary = useMemo(() => {
    if (!history) return null;
    return buildConsultantSolutionSummary(history.actions, assignments);
  }, [history, assignments]);

  const lastTlAction = useMemo(
    () => (history ? lastTeamLeaderAssignmentAction(history.actions) : null),
    [history]
  );

  const solutionReviewed = useMemo(
    () => Boolean(history?.actions.some((a) => a.action === "review_solution")),
    [history]
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy>
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadError || !letter || !history) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError ?? "This letter could not be loaded."} />
        <Link
          href="/dashboard/letters"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to letters
        </Link>
      </div>
    );
  }

  const activeAssignment = assignments.find((a) => a.is_active) ?? null;
  const admin = isAdmin(me);
  const isAssignedWorkflow = Boolean(letter.department);
  const assignmentMeta = [...history.actions]
    .reverse()
    .find((a) => a.action === "approve" || a.action === "route");
  const myConsultantAssignment =
    me &&
    activeAssignment &&
    activeAssignment.consultant_id === me.id &&
    hasRole(me, "Consultant")
      ? activeAssignment
      : null;

  const workflowLocked = letter.status === "closed" || letter.status === "rejected";

  const showAssign =
    canAssignConsultant(me) && !workflowLocked && Boolean(letter.department);

  const showApprovalActions =
    canApprovalActions(me) &&
    !workflowLocked &&
    (letter.status === "received" || letter.status === "returned_for_correction");

  const closureReadiness = consultantWorkReadyForClosure(
    assignments,
    consultantSolutionSummary
  );
  const showClosurePanel =
    canClosure(me) &&
    !workflowLocked &&
    letter.status !== "rejected" &&
    closureReadiness;

  const consultantDeptId =
    workflowDepartmentId(me) ?? letter.department?.id ?? undefined;

  const showConsultantWork = Boolean(
    myConsultantAssignment && me && hasRole(me, "Consultant") && !workflowLocked
  );

  async function submitAdminEdit() {
    if (!letter) return;
    setEditError(null);
    try {
      await updateLetterAdmin(letter.id, {
        memo_no: memoNo.trim() || null,
        subject: subject.trim(),
        received_from: receivedFrom.trim(),
        priority,
      });
      setEditing(false);
      await refresh();
    } catch (e) {
      setEditError(getApiErrorMessage(e));
    }
  }

  async function onDeleteByAdmin() {
    if (!letter) return;
    if (!confirm("Delete this letter permanently?")) return;
    try {
      await deleteLetterAdmin(letter.id);
      window.location.assign("/dashboard/letters");
    } catch (e) {
      setEditError(getApiErrorMessage(e));
    }
  }

  async function submitApproval(action: "approve" | "reject") {
    if (!letter) return;
    const currentLetter = letter;
    if (approvalNote.trim().length < 2) {
      setLoadError("Workflow Note must be at least 2 characters.");
      return;
    }
    setLoadError(null);
    setApprovalPending(true);
    try {
      if (action === "reject") {
        await rejectLetter(letterId, approvalNote.trim());
        toastSuccess("Letter rejected.");
      } else {
        const selectedDepartmentId = approvalDepartmentId
          ? Number(approvalDepartmentId)
          : currentLetter.department?.id;
        if (!selectedDepartmentId) {
          setLoadError("Select a department before approval.");
          return;
        }
        await approveLetter(
          letterId,
          approvalNote.trim(),
          selectedDepartmentId,
          approvalPriority
        );
        toastSuccess("Department assigned and letter approved.");
      }
      setApprovalNote("");
      setApprovalDepartmentId("");
      await refresh();
    } catch (e) {
      const m = getApiErrorMessage(e);
      setLoadError(m);
      toastError(m);
    } finally {
      setApprovalPending(false);
    }
  }

  const adminSummarySection =
    admin ? (
      <div className="rounded-md border border-slate-200 bg-white/80 p-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
          <span className="font-medium text-slate-800">System Admin</span>
          {isAssignedWorkflow ? (
            <span className="text-[10px] text-amber-700">Assigned — limited edit</span>
          ) : null}
        </div>
        {editError ? <p className="mb-2 text-xs text-red-600">{editError}</p> : null}
        {!isAssignedWorkflow ? (
          editing ? (
            <div className="grid gap-1.5">
              <input
                className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                value={memoNo}
                onChange={(e) => setMemoNo(e.target.value)}
                placeholder="Memo No"
              />
              <input
                className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
              />
              <input
                className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="Received from"
              />
              <select
                title="Letter priority"
                className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "normal" | "high" | "urgent")
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => void submitAdminEdit()}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setEditing(true)}
              >
                Edit letter
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => void onDeleteByAdmin()}
              >
                Delete
              </Button>
            </div>
          )
        ) : null}
      </div>
    ) : undefined;

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title={letter.serial_no} description={letter.subject} actions={
          <Link
            href="/dashboard/letters"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Back to list
          </Link>
        }
      />

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {workflowLocked ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            letter.status === "closed"
              ? "border-slate-300 bg-slate-100 text-slate-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          {letter.status === "closed"
            ? "This letter is closed. All workflow actions are read-only; the history below is preserved for audit."
            : "This letter was rejected. Workflow actions are read-only."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="order-1 flex min-h-0 min-w-0 flex-col gap-6 lg:col-span-8">
          <LetterAttachmentPreviewPane letterId={letter.id} pdfPath={letter.pdf_path} />
          <div className="space-y-4 border-t border-slate-200/80 pt-2">
            <LetterStatusTimeline status={letter.status} />
            <WorkflowCommentBlocks actions={history.actions} />
          </div>
        </div>

        <aside
          className={cn(
            "order-2 flex min-w-0 flex-col gap-4 lg:col-span-4 lg:self-start",
            // Consultant letter review: full sidebar height, page scroll only (no inner scrollbar).
            showConsultantWork
              ? "h-auto min-h-0 overflow-visible pb-10 lg:overflow-visible lg:pb-16"
              : "min-h-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-y-contain lg:pr-1 lg:pb-12"
          )}
        >
          <LetterCompactSummary letter={letter} adminSection={adminSummarySection} />

          <div
            className={cn(
              "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
              showConsultantWork && "h-auto overflow-visible"
            )}
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xs font-semibold tracking-wide text-[#123f63] uppercase">
                Workflow &amp; actions
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                Steps for your role. Full audit trail is in the timeline under the attachment.
              </p>
            </div>
            <div className="space-y-4 pt-4 text-sm">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-[11px] leading-relaxed text-slate-700">
                <p className="text-xs font-semibold text-[#123f63]">Approval Head-PEC — Department</p>
                {!letter.department ? (
                  <p className="mt-1.5 text-amber-800">Pending department assignment</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <p>
                      <span className="font-medium text-slate-800">Department: </span>
                      {letter.department.name} ({letter.department.code})
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">By: </span>
                      {assignmentMeta?.acted_by_full_name ||
                        assignmentMeta?.acted_by_email ||
                        "—"}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Time: </span>
                      {assignmentMeta
                        ? new Date(assignmentMeta.created_at).toLocaleString()
                        : "—"}
                    </p>
                    <p className="whitespace-pre-wrap border-t border-slate-200/80 pt-1.5">
                      <span className="font-medium text-slate-800">Note: </span>
                      {assignmentMeta?.comment || "—"}
                    </p>
                  </div>
                )}
              </div>

              {activeAssignment &&
              !(showConsultantWork && myConsultantAssignment) ? (
                <AssignmentRecipientSummary
                  assignment={activeAssignment}
                  letterDepartment={letter.department}
                  teamLeaderComment={lastTlAction?.comment ?? null}
                />
              ) : null}

              {showApprovalActions ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
                  <p className="text-xs font-semibold text-[#123f63]">Your decision</p>
                  <div className="grid gap-1">
                    <label htmlFor="approval-note" className="text-sm font-medium">
                      Workflow note
                    </label>
                    <textarea
                      id="approval-note"
                      title="Workflow note"
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Write approval or rejection note…"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <label htmlFor="approval-dept" className="text-sm font-medium">
                        Assign department
                      </label>
                      <select
                        id="approval-dept"
                        title="Assign department"
                        value={approvalDepartmentId}
                        onChange={(e) => setApprovalDepartmentId(e.target.value)}
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={String(d.id)}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <label htmlFor="approval-priority" className="text-sm font-medium">
                        Priority
                      </label>
                      <select
                        id="approval-priority"
                        title="Priority"
                        value={approvalPriority}
                        onChange={(e) =>
                          setApprovalPriority(
                            e.target.value as "low" | "normal" | "high" | "urgent"
                          )
                        }
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={approvalPending || approvalNote.trim().length < 2}
                      onClick={() => void submitApproval("approve")}
                    >
                      Assign department / Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={approvalPending || approvalNote.trim().length < 2}
                      onClick={() => void submitApproval("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}

              {showAssign && letter.department ? (
                <TeamLeaderAssignmentPanel
                  letterId={letterId}
                  departmentId={letter.department.id}
                  activeAssignment={activeAssignment}
                  lastTeamLeaderAction={lastTlAction}
                  onSuccess={() => void refresh()}
                />
              ) : null}

              {showConsultantWork && myConsultantAssignment ? (
                <ConsultantAssignmentWork
                  row={{
                    assignment: myConsultantAssignment,
                    letter_id: letter.id,
                    serial_no: letter.serial_no,
                    memo_no: letter.memo_no,
                    subject: letter.subject,
                    received_from: letter.received_from,
                    deadline_at: myConsultantAssignment.deadline_at,
                    letter_department: letter.department ?? undefined,
                  }}
                  departmentId={consultantDeptId ?? 0}
                  onUpdated={() => void refresh()}
                  teamLeaderComment={lastTlAction?.comment ?? null}
                />
              ) : null}

              {showClosurePanel ? (
                <ClosurePanel
                  letterId={letterId}
                  onChanged={() => void refresh()}
                  consultantSolutionSummary={consultantSolutionSummary}
                  solutionReviewed={solutionReviewed}
                />
              ) : null}

              {!showApprovalActions &&
              !showAssign &&
              !showConsultantWork &&
              !showClosurePanel &&
              !workflowLocked ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isReceivingOfficer(me)
                    ? "Receiving Officer view is read-only here. Inward registration is from Receive letter; routing is handled by Approval Head-PEC and Team Leaders."
                    : "No actions are available for your role at this stage. Use the attachment and timeline on the left."}
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
}
