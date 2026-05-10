"use client";

import { useMemo } from "react";

import { actionStatusLabel } from "@/components/letters/letter-workflow-comment-blocks";
import { cn } from "@/lib/utils";
import type { AssignmentOut, LetterActionHistoryItem } from "@/types/letter";

/** Actions that form the auditable workflow trace (exclude pure admin letter edits). */
const TIMELINE_ACTIONS = new Set([
  "approve",
  "reject",
  "return_for_correction",
  "route",
  "assign_consultant",
  "reassign_consultant",
  "consultant_status_update",
  "resolution_note",
  "solution_file_upload",
  "transfer_assignment",
  "review_solution",
  "final_comment",
  "close_issue",
]);

function deptLabel(
  id: number | null | undefined,
  departmentById: Record<number, string> | undefined
): string | null {
  if (id == null) return null;
  const fromMap = departmentById?.[id];
  if (fromMap) return fromMap;
  return `Department #${id}`;
}

function formatActor(a: LetterActionHistoryItem): string {
  const name = a.acted_by_full_name || a.acted_by_email;
  const roles = a.acted_by_roles?.filter(Boolean).join(" — ");
  if (name && roles) return `${name} — ${roles}`;
  if (name) return name;
  if (roles) return roles;
  return `User #${a.acted_by}`;
}

function pairTlActionsToAssignments(
  actions: LetterActionHistoryItem[],
  assignments: AssignmentOut[]
): Map<number, AssignmentOut> {
  const tlChrono = [...actions]
    .filter((a) => a.action === "assign_consultant" || a.action === "reassign_consultant")
    .sort((a, b) => a.id - b.id);
  const asgChrono = [...assignments].sort(
    (x, y) => new Date(x.assigned_at).getTime() - new Date(y.assigned_at).getTime()
  );
  const map = new Map<number, AssignmentOut>();
  tlChrono.forEach((act, i) => {
    const row = asgChrono[i];
    if (row) map.set(act.id, row);
  });
  return map;
}

function targetSummary(
  action: LetterActionHistoryItem,
  departmentById: Record<number, string> | undefined,
  assignmentByActionId: Map<number, AssignmentOut>
): string | null {
  const asg = assignmentByActionId.get(action.id);
  switch (action.action) {
    case "approve":
    case "route": {
      const from = deptLabel(action.from_department_id, departmentById);
      const to = deptLabel(action.to_department_id, departmentById);
      if (action.action === "approve" && to) return `Department: ${to}`;
      if (from && to && from !== to) return `Department: ${from} → ${to}`;
      if (to) return `Department: ${to}`;
      if (from) return `From department: ${from}`;
      return null;
    }
    case "assign_consultant":
    case "reassign_consultant": {
      if (asg?.consultant_user) {
        const r = asg.consultant_user.roles?.length
          ? asg.consultant_user.roles.join(", ")
          : "";
        const who = asg.consultant_user.full_name;
        return r ? `${who} — ${r}` : who;
      }
      return null;
    }
    case "transfer_assignment": {
      const head = action.comment?.split("\n\n")[0]?.trim() ?? "";
      if (head.startsWith("Transferred to:")) return head.replace(/^Transferred to:\s*/i, "").trim();
      return null;
    }
    case "resolution_note":
      return "Solution / resolution recorded";
    case "solution_file_upload":
      return "Solution file attached";
    case "consultant_status_update":
      return "Status update";
    case "review_solution":
      return "Closure — solution reviewed";
    case "final_comment":
      return "Closure — final comment";
    case "close_issue":
      return "Letter closed";
    case "reject":
      return "Rejected";
    case "return_for_correction":
      return "Returned for correction";
    default:
      return null;
  }
}

/** For transfer actions with structured comment, return user note only for the Note row. */
function noteForDisplay(action: LetterActionHistoryItem): string | null {
  const raw = action.comment?.trim();
  if (!raw) return null;
  if (action.action === "transfer_assignment" && raw.includes("\n\n")) {
    const parts = raw.split("\n\n");
    const rest = parts.slice(1).join("\n\n").trim();
    return rest || null;
  }
  return raw;
}

function actionBadgeClass(action: string): string {
  if (action === "close_issue" || action === "reject") return "bg-red-500/10 text-red-900 border-red-200";
  if (action === "approve" || action === "route") return "bg-emerald-500/10 text-emerald-900 border-emerald-200";
  if (action === "assign_consultant" || action === "reassign_consultant")
    return "bg-indigo-500/10 text-indigo-900 border-indigo-200";
  if (action === "transfer_assignment") return "bg-teal-500/10 text-teal-900 border-teal-200";
  if (action === "resolution_note" || action === "solution_file_upload")
    return "bg-cyan-500/10 text-cyan-900 border-cyan-200";
  return "bg-slate-500/8 text-slate-800 border-slate-200";
}

export function workflowTimelineActions(actions: LetterActionHistoryItem[]): LetterActionHistoryItem[] {
  const seen = new Set<number>();
  const out: LetterActionHistoryItem[] = [];
  for (const a of actions) {
    if (!TIMELINE_ACTIONS.has(a.action)) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out.sort((a, b) => {
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
}

type WorkflowForwardingHistoryProps = {
  actions: LetterActionHistoryItem[];
  departmentById?: Record<number, string>;
  assignments?: AssignmentOut[];
  className?: string;
  /** Landmark id for `aria-labelledby` on the parent section (default: workflow-history-heading). */
  headingId?: string;
};

const DEFAULT_HEADING_ID = "workflow-history-heading";

export function WorkflowForwardingHistory({
  actions,
  departmentById,
  assignments = [],
  className,
  headingId = DEFAULT_HEADING_ID,
}: WorkflowForwardingHistoryProps) {
  const rows = useMemo(() => workflowTimelineActions(actions), [actions]);
  const assignmentByActionId = useMemo(
    () => pairTlActionsToAssignments(actions, assignments),
    [actions, assignments]
  );

  if (!rows.length) {
    return (
      <div
        className={cn(
          "w-full rounded-2xl border border-slate-200 bg-slate-50/40 px-4 py-6 shadow-sm sm:px-6",
          className
        )}
      >
        <h2 id={headingId} className="text-sm font-semibold tracking-wide text-[#123f63] uppercase">
          Workflow history / Audit trail
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          No workflow steps recorded yet. Entries will appear here after approval, routing,
          assignment, consultant work, transfers, and closure.
        </p>
      </div>
    );
  }

  const listScrollClass =
    rows.length > 6 ? "max-h-[min(68vh,720px)] overflow-y-auto overscroll-contain pr-1 sm:pr-2" : "";

  return (
    <div className={cn("w-full px-0 sm:px-0", className)}>
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-4 py-6 shadow-sm sm:px-8 sm:py-8">
        <h2 id={headingId} className="text-sm font-semibold tracking-wide text-[#123f63] uppercase">
          Workflow history / Audit trail
        </h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-[12px] leading-relaxed sm:text-sm">
          Newest first. PEC routing, team leader assignments and forwards, consultant work,
          transfers, and closure are listed here for audit.
        </p>

        <ul className={cn("mt-6 list-none space-y-0 p-0", listScrollClass)} role="list">
          {rows.map((a, idx) => {
            const isLast = idx === rows.length - 1;
            const headline = actionStatusLabel(a.action);
            const toOrTarget = targetSummary(a, departmentById, assignmentByActionId);
            const noteOnly = noteForDisplay(a);
            const showTo =
              toOrTarget &&
              (a.action === "assign_consultant" ||
                a.action === "reassign_consultant" ||
                a.action === "transfer_assignment" ||
                a.action === "approve" || a.action === "route");

            return (
              <li key={a.id} className="relative flex gap-0">
                <div className="flex w-8 shrink-0 flex-col items-center sm:w-10" aria-hidden>
                  <span
                    className={cn(
                      "z-[1] mt-1 size-3 shrink-0 rounded-full border-2 border-[#123f63] bg-white shadow-sm",
                      "sm:mt-1.5 sm:size-3.5"
                    )}
                  />
                  {!isLast ? (
                    <span className="mt-1 min-h-[4.5rem] w-px flex-1 grow bg-slate-200 sm:min-h-[5rem]" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-8 pl-2 sm:pl-4">
                  <div className="rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-sm ring-1 ring-slate-100/80">
                    <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                      <p className="text-[15px] font-semibold leading-snug text-[#123f63]">{headline}</p>
                      <span
                        className={cn(
                          "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          actionBadgeClass(a.action)
                        )}
                      >
                        {a.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-2 text-[13px] text-slate-800">
                      <div>
                        <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                          By
                        </dt>
                        <dd className="mt-0.5">{formatActor(a)}</dd>
                      </div>
                      {showTo && toOrTarget ? (
                        <div>
                          <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                            {a.action === "transfer_assignment"
                              ? "To"
                              : a.action === "approve" || a.action === "route"
                                ? "Routing"
                                : "Assigned to"}
                          </dt>
                          <dd className="mt-0.5 font-medium text-slate-900">{toOrTarget}</dd>
                        </div>
                      ) : toOrTarget && !showTo ? (
                        <div>
                          <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                            Detail
                          </dt>
                          <dd className="mt-0.5">{toOrTarget}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                          Time
                        </dt>
                        <dd className="mt-0.5">
                          <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString()}</time>
                        </dd>
                      </div>
                      {noteOnly ? (
                        <div className="border-t border-slate-100 pt-2">
                          <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                            Note
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                            {noteOnly}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
