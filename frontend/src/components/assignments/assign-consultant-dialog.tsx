"use client";

import { useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { assignConsultant, reassignConsultant } from "@/lib/api/assignments";
import { listAssignableWorkflowUsers } from "@/lib/api/users";
import { assignForwardRecipientLabel, primaryWorkflowRoleLabel } from "@/lib/workflow-user-label";
import { toastSuccess } from "@/lib/toast";
import type { UserOut } from "@/types/user";

type AssignConsultantDialogProps = {
  letterId: number;
  departmentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "assign" | "reassign";
  onSuccess: () => void;
};

function toIsoDeadline(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline");
  return d.toISOString();
}

export function AssignConsultantDialog({
  letterId,
  departmentId,
  open,
  onOpenChange,
  mode,
  onSuccess,
}: AssignConsultantDialogProps) {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [recipientId, setRecipientId] = useState("");
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
    if (!open) return;
    setError(null);
    setComment("");
    setDeadline("");
    setRecipientId("");
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
  }, [open, departmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cid = Number(recipientId);
    if (!cid) {
      setError("Select a recipient.");
      return;
    }
    if (comment.trim().length < 2) {
      setError("Workflow note / comment must be at least 2 characters.");
      return;
    }
    let deadlineIso: string | null | undefined;
    if (deadline.trim()) {
      try {
        deadlineIso = toIsoDeadline(deadline);
      } catch {
        setError("Invalid deadline.");
        return;
      }
    } else {
      deadlineIso = undefined;
    }
    setPending(true);
    try {
      const body = {
        target_user_id: cid,
        deadline_at: deadlineIso ?? null,
        comment: comment.trim(),
      };
      if (mode === "assign") {
        await assignConsultant(letterId, body);
      } else {
        await reassignConsultant(letterId, body);
      }
      toastSuccess(mode === "assign" ? "Assignment saved successfully." : "Letter forwarded successfully.");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Assign / Forward</DialogTitle>
            <DialogDescription>
              Choose any active Team Leader or Consultant from any department. Department is
              informational only.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="recipient">Recipient</Label>
              <select
                id="recipient"
                title="Recipient"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
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

            <FormField id="deadline" label="Deadline (optional)" error={null}>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </FormField>

            <div className="grid gap-2">
              <Label htmlFor="comment">Workflow note / comment</Label>
              <textarea
                id="comment"
                title="Workflow note"
                className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Required (min 2 characters)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || comment.trim().length < 2 || !recipientId}
            >
              {pending ? "Saving…" : mode === "assign" ? "Assign" : "Forward"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
