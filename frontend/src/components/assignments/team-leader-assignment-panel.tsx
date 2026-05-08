"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { assignConsultant, reassignConsultant } from "@/lib/api/assignments";
import { listAssignableWorkflowUsers } from "@/lib/api/users";
import { useAuth } from "@/context/auth-context";
import { userHasPermission } from "@/lib/auth/permissions";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AssignmentOut, LetterActionHistoryItem } from "@/types/letter";
import type { UserOut } from "@/types/user";

type TeamLeaderAssignmentPanelProps = {
  letterId: number;
  departmentId: number;
  activeAssignment: AssignmentOut | null;
  lastTeamLeaderAction: LetterActionHistoryItem | null;
  onSuccess: () => void;
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
      const m = "Team Leader comment must be at least 2 characters.";
      setError(m);
      toastError(m);
      return;
    }
    if (!deadline.trim()) {
      const m = "Deadline is required.";
      setError(m);
      toastError(m);
      return;
    }
    let deadlineIso: string;
    try {
      deadlineIso = toIsoDeadline(deadline);
    } catch {
      const m = "Invalid deadline.";
      setError(m);
      toastError(m);
      return;
    }
    setPending(true);
    try {
      if (activeAssignment) {
        await reassignConsultant(letterId, {
          consultant_id: cid,
          deadline_at: deadlineIso,
          comment: comment.trim(),
        });
        toastSuccess("Letter forwarded successfully.");
      } else {
        await assignConsultant(letterId, {
          consultant_id: cid,
          deadline_at: deadlineIso,
          comment: comment.trim(),
        });
        toastSuccess("Consultant assigned successfully.");
      }
      setComment("");
      setAssigneeId("");
      setDeadline("");
      onSuccess();
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
        <p className="text-sm font-semibold text-[#123f63]">Team Leader — Assign / forward</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
          Route this letter to a Consultant or Team Leader. Your comment is stored in the workflow
          history.
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
        <p className="text-muted-foreground text-xs">No prior team leader assignment on this letter.</p>
      )}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {!canSubmit ? (
        <p className="text-muted-foreground text-xs">
          You do not have permission to {activeAssignment ? "reassign" : "assign"} consultants for this
          letter.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="tl-assignee">Assign to</Label>
        <select
          id="tl-assignee"
          title="Assign to"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          disabled={!canSubmit}
        >
          <option value="">Select…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} — {u.roles.map((r) => r.name).join(", ")} —{" "}
              {u.department?.name ?? "No department"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tl-deadline">Deadline</Label>
        <input
          id="tl-deadline"
          type="datetime-local"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={!canSubmit}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="tl-comment">Team Leader comment / workflow note</Label>
        <textarea
          id="tl-comment"
          title="Team Leader comment"
          className="border-input bg-background min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Instructions for the assignee…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={!canSubmit}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={
            pending ||
            comment.trim().length < 2 ||
            !assigneeId ||
            !deadline ||
            !canSubmit
          }
          onClick={() => void handleSubmit()}
        >
          {pending ? "Saving…" : activeAssignment ? "Forward" : "Assign"}
        </Button>
        <Link
          href="/dashboard/letters"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to list
        </Link>
      </div>
    </div>
  );
}
