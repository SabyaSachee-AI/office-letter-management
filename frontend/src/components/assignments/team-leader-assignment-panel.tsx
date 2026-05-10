"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { assignConsultant, reassignConsultant } from "@/lib/api/assignments";
import { listAssignableWorkflowUsers } from "@/lib/api/users";
import { useAuth } from "@/context/auth-context";
import { userHasPermission } from "@/lib/auth/permissions";
import { assignForwardRecipientLabel, primaryWorkflowRoleLabel } from "@/lib/workflow-user-label";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AssignmentOut, LetterActionHistoryItem } from "@/types/letter";
import type { UserOut } from "@/types/user";

type TeamLeaderAssignmentPanelProps = {
  letterId: number;
  departmentId: number;
  activeAssignment: AssignmentOut | null;
  lastTeamLeaderAction: LetterActionHistoryItem | null;
  listHref?: string;
  listLabel?: string;
  /** Called after a successful assign/reassign; pass API assignment for optimistic UI merge if refresh fails. */
  onSuccess: (assignment?: AssignmentOut) => void;
};

function toIsoDeadline(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline");
  return d.toISOString();
}

export function TeamLeaderAssignmentPanel({
  letterId,
  departmentId,
  activeAssignment,
  lastTeamLeaderAction,
  listHref = "/dashboard/letters",
  listLabel = "Back to list",
  onSuccess,
}: TeamLeaderAssignmentPanelProps) {
  const { user } = useAuth();
  const canAssignFirst = userHasPermission(user, "assignment:assign");
  const canReassign = userHasPermission(user, "assignment:reassign");
  const canSubmit = activeAssignment ? canReassign : canAssignFirst;

  const [users, setUsers] = useState<UserOut[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamLeaders = useMemo(
    () => users.filter((u) => primaryWorkflowRoleLabel(u) === "Team Leader"),
    [users]
  );
  const consultants = useMemo(
    () => users.filter((u) => primaryWorkflowRoleLabel(u) === "Consultant"),
    [users]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listAssignableWorkflowUsers();
        if (!cancelled) setUsers(items);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  async function handleSubmit() {
    setError(null);
    const cid = Number(assigneeId);
    if (!cid) {
      const m = "Select a recipient.";
      setError(m);
      toastError(m);
      return;
    }
    if (comment.trim().length < 2) {
      const m = "Workflow note / comment must be at least 2 characters.";
      setError(m);
      toastError(m);
      return;
    }
    let deadlineIso: string | null | undefined;
    if (deadline.trim()) {
      try {
        deadlineIso = toIsoDeadline(deadline);
      } catch {
        const m = "Invalid deadline.";
        setError(m);
        toastError(m);
        return;
      }
    } else {
      deadlineIso = undefined;
    }
    setPending(true);
    try {
      let created: AssignmentOut | undefined;
      const body = {
        target_user_id: cid,
        deadline_at: deadlineIso ?? null,
        comment: comment.trim(),
      };
      if (activeAssignment) {
        created = await reassignConsultant(letterId, body);
        toastSuccess("Letter forwarded successfully.");
      } else {
        created = await assignConsultant(letterId, body);
        toastSuccess("Assignment saved successfully.");
      }
      setComment("");
      setAssigneeId("");
      setDeadline("");
      onSuccess(created);
    } catch (e) {
      const m = getApiErrorMessage(e);
      setError(m);
      toastError(m);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#d7e6f6] bg-[#f8fbff] p-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-[#123f63]">Assign / Forward</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
          Route this letter to any active Team Leader or Consultant in any department. Department is
          informational only. Your workflow note is stored in history.
        </p>
      </div>

      {lastTeamLeaderAction ? (
        <div className="rounded-md border border-slate-200 bg-white/95 p-2.5 text-xs text-slate-700">
          <p className="font-medium text-[#123f63]">Previous note (read-only)</p>
          <p className="mt-1 whitespace-pre-wrap">{lastTeamLeaderAction.comment}</p>
          <p className="text-muted-foreground mt-2">
            {lastTeamLeaderAction.acted_by_full_name ||
              lastTeamLeaderAction.acted_by_email ||
              `User #${lastTeamLeaderAction.acted_by}`}
            {" · "}
            {new Date(lastTeamLeaderAction.created_at).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No prior routing note on this letter.</p>
      )}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {!canSubmit ? (
        <p className="text-muted-foreground text-xs">
          You do not have permission to {activeAssignment ? "forward" : "assign"} this letter.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="tl-assignee">Recipient</Label>
        <select
          id="tl-assignee"
          title="Recipient"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          disabled={!canSubmit}
        >
          <option value="">Select…</option>
          {teamLeaders.length > 0 ? (
            <optgroup label="Team Leaders">
              {teamLeaders.map((u) => (
                <option key={u.id} value={u.id}>
                  {assignForwardRecipientLabel(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {consultants.length > 0 ? (
            <optgroup label="Consultants">
              {consultants.map((u) => (
                <option key={u.id} value={u.id}>
                  {assignForwardRecipientLabel(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tl-deadline">Deadline (optional)</Label>
        <input
          id="tl-deadline"
          type="datetime-local"
          title="Deadline"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={!canSubmit}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="tl-comment">Workflow note / comment</Label>
        <textarea
          id="tl-comment"
          title="Workflow note"
          className="border-input bg-background min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Required: context for the recipient (min 2 characters)…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={!canSubmit}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={pending || comment.trim().length < 2 || !assigneeId || !canSubmit}
          onClick={() => void handleSubmit()}
        >
          {pending ? "Saving…" : activeAssignment ? "Forward" : "Assign"}
        </Button>
        <Link href={listHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {listLabel}
        </Link>
      </div>
    </div>
  );
}
