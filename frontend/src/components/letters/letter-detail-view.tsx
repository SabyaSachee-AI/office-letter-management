"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TeamLeaderAssignmentPanel } from "@/components/assignments/team-leader-assignment-panel";
import { ClosurePanel } from "@/components/closure/closure-panel";
import { ConsultantAssignmentWork } from "@/components/consultant/consultant-assignment-work";
import { ErrorBanner } from "@/components/data/error-banner";
import { LetterAttachmentPreviewPane } from "@/components/letters/letter-attachment-preview-pane";
import { LetterReviewCompactHeader } from "@/components/letters/letter-review-compact-header";
import { WorkflowForwardingHistory } from "@/components/letters/workflow-forwarding-history";
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
  hasRole,
  isAdmin,
  isReceivingOfficer,
  workflowDepartmentId,
} from "@/lib/auth/roles";
import { userHasPermission } from "@/lib/auth/permissions";
import {
  buildConsultantSolutionSummary,
  consultantWorkReadyForClosure,
  lastTeamLeaderAssignmentAction,
} from "@/lib/letter-workflow";
import { getVisibleWorkflowStatus } from "@/lib/workflow-display";
import { cn } from "@/lib/utils";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import type { AssignmentOut, ClosureHistoryResponse, LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

export type LetterModuleContext = "letters" | "approval" | "assignment" | "consultant" | "closure";

function backLinkForErrorState(ctx: LetterModuleContext): { href: string; label: string } {
  switch (ctx) {
    case "approval":
      return { href: "/dashboard/approval", label: "Back to Approval Queue" };
    case "assignment":
      return { href: "/dashboard/assignment", label: "Back to Assignment" };
    case "consultant":
      return { href: "/dashboard/consultant", label: "Back to Consultant Workspace" };
    case "closure":
      return { href: "/dashboard/closure", label: "Back to Closure" };
    default:
      return { href: "/dashboard/letters", label: "Back to letters" };
  }
}

type LetterDetailViewProps = {
  letterId: number;
  /** Which module opened this letter — drives back navigation and which action panels apply. */
  moduleContext?: LetterModuleContext;
};

function mergeAssignmentsAfterReassign(prev: AssignmentOut[], next: AssignmentOut): AssignmentOut[] {
  return [
    ...prev.map((a) =>
      a.is_active ? { ...a, is_active: false, work_status: "transferred" as AssignmentOut["work_status"] } : a
    ),
    next,
  ];
}

export function LetterDetailView({ letterId, moduleContext = "letters" }: LetterDetailViewProps) {
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

  const refreshAfterAssignmentSave = useCallback(
    async (newAssignment?: AssignmentOut) => {
      const snapshot =
        letter && history
          ? { letter: { ...letter }, history: { ...history }, assignments: [...assignments] }
          : null;
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
        const msg = getApiErrorMessage(e);
        if (moduleContext === "assignment" && snapshot) {
          const merged = newAssignment
            ? mergeAssignmentsAfterReassign(snapshot.assignments, newAssignment)
            : snapshot.assignments;
          setLetter(snapshot.letter);
          setMemoNo(snapshot.letter.memo_no ?? "");
          setSubject(snapshot.letter.subject);
          setReceivedFrom(snapshot.letter.received_from);
          setPriority(snapshot.letter.priority);
          setHistory(snapshot.history);
          setAssignments(merged);
          setLoadError(null);
          toastWarning(
            "Assignment saved, but the detail view could not fully refresh. Return to the Assignment list and reopen this letter if something looks outdated."
          );
        } else {
          setLoadError(msg);
          setLetter(null);
          setHistory(null);
          setAssignments([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [letterId, letter, history, assignments, moduleContext]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (moduleContext === "closure" || window.location.hash === "#closure") {
      requestAnimationFrame(() => {
        document.getElementById("closure")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [moduleContext, letter]);

  const letterIdForDeptFetch = letter?.id ?? null;
  const historyLetterIdForDeptFetch = history?.letter_id ?? null;
  useEffect(() => {
    if (letterIdForDeptFetch == null || historyLetterIdForDeptFetch == null) return;
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
  }, [letterIdForDeptFetch, historyLetterIdForDeptFetch]);

  const consultantSolutionSummary = useMemo(() => {
    if (!history) return null;
    return buildConsultantSolutionSummary(history.actions, assignments);
  }, [history, assignments]);

  const departmentById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const d of departments) {
      m[d.id] = `${d.name} (${d.code})`;
    }
    const ld = letter?.department;
    if (ld) {
      m[ld.id] = `${ld.name} (${ld.code})`;
    }
    return m;
  }, [departments, letter?.department]);

  const lastTlAction = useMemo(
    () => (history ? lastTeamLeaderAssignmentAction(history.actions) : null),
    [history]
  );

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.is_active),
    [assignments]
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
    const eb = backLinkForErrorState(moduleContext);
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError ?? "This letter could not be loaded."} />
        <Link href={eb.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {eb.label}
        </Link>
      </div>
    );
  }

  const singleActiveAssignment = activeAssignments.length === 1 ? activeAssignments[0] : null;
  const tlRoutingAssignment =
    activeAssignments.length > 0
      ? [...activeAssignments].sort(
          (a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
        )[0]!
      : null;
  const isConsultantActor =
    !!me && (hasRole(me, "Consultant") || userHasPermission(me, "consultant:view"));
  const lettersSmartConsultantBack =
    !!me && activeAssignments.some((a) => a.consultant_id === me.id) && isConsultantActor;
  const moduleBack = moduleContext !== "letters" ? backLinkForErrorState(moduleContext) : null;
  const backToListHref =
    moduleBack?.href ?? (lettersSmartConsultantBack ? "/dashboard/consultant" : "/dashboard/letters");
  const backToListLabel =
    moduleBack?.label ??
    (lettersSmartConsultantBack ? "Back to Consultant Workspace" : "Back to Letters");
  const visibleWorkflow = getVisibleWorkflowStatus(letter, singleActiveAssignment ?? tlRoutingAssignment, {
    preferPendingFinalClosure: true,
  });
  const admin = isAdmin(me);
  const isAssignedWorkflow = Boolean(letter.department);
  const assignmentMeta = [...history.actions]
    .reverse()
    .find((a) => a.action === "approve" || a.action === "route");
  const myConsultantAssignment =
    me && isConsultantActor
      ? (activeAssignments.find((a) => a.consultant_id === me.id) ?? null)
      : null;

  const consultantEvidenceAssignment =
    activeAssignments.find(
      (a) =>
        a.work_status === "resolved" ||
        Boolean((a.resolution_note ?? "").trim()) ||
        Boolean(a.has_solution_file)
    ) ?? tlRoutingAssignment;

  const workflowLocked = letter.status === "closed" || letter.status === "rejected";

  const showAssign =
    (moduleContext === "letters" || moduleContext === "assignment") &&
    canAssignConsultant(me) &&
    !workflowLocked &&
    Boolean(letter.department);

  const showApprovalActions =
    (moduleContext === "letters" || moduleContext === "approval") &&
    canApprovalActions(me) &&
    !workflowLocked &&
    (letter.status === "received" || letter.status === "returned_for_correction");

  const canApproveLetter = userHasPermission(me, "approval:approve");
  const canRejectLetter = userHasPermission(me, "approval:reject");

  const closureReadiness = consultantWorkReadyForClosure(
    assignments,
    consultantSolutionSummary
  );
  const showClosurePanel =
    closureReadiness &&
    !workflowLocked &&
    letter.status !== "rejected" &&
    (userHasPermission(me, "closure:view") ||
      (moduleContext !== "consultant" && Boolean(myConsultantAssignment)));

  const consultantDeptId =
    workflowDepartmentId(me) ?? letter.department?.id ?? undefined;

  const consultantPanelContexts: LetterModuleContext[] = ["letters", "consultant", "assignment"];
  const showConsultantWork = Boolean(
    consultantPanelContexts.includes(moduleContext) &&
      myConsultantAssignment &&
      me &&
      isConsultantActor &&
      !workflowLocked
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
    moduleContext === "letters" && admin ? (
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
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!userHasPermission(me, "letters:update")}
                  onClick={() => void submitAdminEdit()}
                >
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
                disabled={!userHasPermission(me, "letters:update")}
                onClick={() => setEditing(true)}
              >
                Edit letter
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                disabled={!userHasPermission(me, "letters:delete")}
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
    <div className="space-y-4 pb-8">
      <LetterReviewCompactHeader
        letter={letter}
        visibleLabel={visibleWorkflow.visibleLabel}
        currentHolderLabel={visibleWorkflow.currentHolderLabel}
        internalStatus={visibleWorkflow.internalStatus}
        showInternalStatus={admin}
        backHref={backToListHref}
        backLabel={backToListLabel}
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

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="order-1 min-h-0 min-w-0 flex-1 lg:order-1 lg:max-w-[70%] lg:flex-[7]">
          <LetterAttachmentPreviewPane
            letterId={letter.id}
            pdfPath={letter.pdf_path}
            variant="documentFirst"
            hideFileNameCaption
          />
        </div>

        <aside
          className={cn(
            "order-2 flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100dvh-2rem)] lg:max-w-[30%] lg:flex-[3] lg:self-start lg:overflow-y-auto lg:pb-0"
          )}
        >
          {adminSummarySection ? (
            <div className="rounded-lg border border-slate-200 bg-white/90 p-2">{adminSummarySection}</div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xs font-semibold tracking-wide text-[#123f63] uppercase">
                Next action for you
              </h2>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                Role-based steps only. Status and responsible user are in the header; the full audit
                trail is below the document.
              </p>
            </div>
            <div className="space-y-4 pt-4 text-sm">
              {showApprovalActions ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                  <div>
                    <p className="text-xs font-semibold text-[#123f63]">Your task</p>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      Review the attachment, record a workflow note, select the receiving department
                      and priority, then approve or reject.
                    </p>
                  </div>
                  {!canApproveLetter && !canRejectLetter ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      You can view this letter&apos;s approval context but do not have permission to
                      approve or reject.
                    </p>
                  ) : null}
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
                      disabled={
                        approvalPending ||
                        approvalNote.trim().length < 2 ||
                        !canApproveLetter
                      }
                      onClick={() => void submitApproval("approve")}
                    >
                      Assign department / Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        approvalPending ||
                        approvalNote.trim().length < 2 ||
                        !canRejectLetter
                      }
                      onClick={() => void submitApproval("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}

              {showAssign && letter.department ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-[#123f63]">Your task</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Assign or forward to a Team Leader or Consultant (any department), with an optional
                      deadline and workflow note.
                    </p>
                  </div>
                  <TeamLeaderAssignmentPanel
                    letterId={letterId}
                    departmentId={letter.department.id}
                    activeAssignment={tlRoutingAssignment}
                    lastTeamLeaderAction={lastTlAction}
                    listHref={backToListHref}
                    listLabel={backToListLabel}
                    onSuccess={(created) => void refreshAfterAssignmentSave(created)}
                  />
                </div>
              ) : null}

              {showConsultantWork && myConsultantAssignment ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-[#123f63]">Your task</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Submit your solution (note and optional file), mark resolved, or transfer the
                      assignment with context.
                    </p>
                  </div>
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
                  letterStatus={letter.status}
                  onUpdated={() => void refresh()}
                  teamLeaderComment={lastTlAction?.comment ?? null}
                />
                </div>
              ) : null}

              {showClosurePanel ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-[#123f63]">Your task</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Review consultant evidence, add closure remarks, and officially close when permitted.
                    </p>
                  </div>
                  <ClosurePanel
                  letterId={letterId}
                  onChanged={() => void refresh()}
                  consultantSolutionSummary={consultantSolutionSummary}
                  solutionReviewed={solutionReviewed}
                  canReviewSolution={userHasPermission(me, "closure:review")}
                  canSaveFinalRemark={userHasPermission(me, "closure:review")}
                  canOfficialClose={userHasPermission(me, "closure:close")}
                  consultantWorkEvidenceReady={activeAssignments.some(
                    (a) =>
                      a.work_status === "resolved" ||
                      Boolean((a.resolution_note ?? "").trim()) ||
                      Boolean(a.has_solution_file)
                  )}
                  approvalNote={
                    assignmentMeta
                      ? {
                          comment: assignmentMeta.comment,
                          actor:
                            assignmentMeta.acted_by_full_name ||
                            assignmentMeta.acted_by_email ||
                            `User #${assignmentMeta.acted_by}`,
                          department: letter.department
                            ? `${letter.department.name} (${letter.department.code})`
                            : "—",
                          timestamp: assignmentMeta.created_at,
                        }
                      : null
                  }
                  teamLeaderNote={
                    lastTlAction
                      ? {
                          comment: lastTlAction.comment,
                          actor:
                            lastTlAction.acted_by_full_name ||
                            lastTlAction.acted_by_email ||
                            `User #${lastTlAction.acted_by}`,
                          assignedTo:
                            activeAssignments.length > 1
                              ? `${activeAssignments.length} active assignees`
                              : tlRoutingAssignment?.consultant_user?.full_name ||
                                `User #${tlRoutingAssignment?.consultant_id ?? "-"}`,
                          timestamp: lastTlAction.created_at,
                        }
                      : null
                  }
                  consultantNote={
                    consultantEvidenceAssignment
                      ? {
                          note: consultantEvidenceAssignment.resolution_note,
                          hasFile: Boolean(consultantEvidenceAssignment.has_solution_file),
                          resolvedBy:
                            consultantEvidenceAssignment.consultant_user?.full_name ||
                            `User #${consultantEvidenceAssignment.consultant_id}`,
                          resolvedAt:
                            consultantEvidenceAssignment.latest_solution_file_uploaded_at ??
                            consultantEvidenceAssignment.updated_at,
                          workStatus: consultantEvidenceAssignment.work_status,
                        }
                      : null
                  }
                />
                </div>
              ) : null}

              {activeAssignments.length > 1 ? (
                <div className="rounded-lg border border-violet-200/80 bg-violet-50/60 p-3 text-sm text-slate-800">
                  <p className="text-xs font-semibold text-[#123f63] uppercase">Multiple active assignments</p>
                  <p className="mt-1 text-[13px]">
                    {activeAssignments.length} users currently have an{" "}
                    <span className="font-medium">active assignment</span> on this letter (
                    {visibleWorkflow.visibleLabel}).
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Open workflow history below for each step and assignee.
                  </p>
                </div>
              ) : null}

              {!showApprovalActions &&
              !showAssign &&
              !showConsultantWork &&
              !showClosurePanel &&
              !workflowLocked ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-700">
                  <p className="font-semibold text-[#123f63]">Progress</p>
                  <p className="text-muted-foreground mt-1">
                    {isReceivingOfficer(me)
                      ? "Receiving Officer: this view is read-only. Inward registration is from Receive letter; routing is handled by Approval Head-PEC and Team Leaders."
                      : "No workflow actions are available for your role at this stage. Review the document above; the section below lists every recorded step."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <section
        className="mt-8 border-t border-slate-200/90 pt-6 lg:mt-10 lg:pt-8"
        aria-labelledby="workflow-history-heading"
      >
        <WorkflowForwardingHistory
          actions={history.actions}
          departmentById={departmentById}
          assignments={assignments}
        />
      </section>
    </div>
  );
}
