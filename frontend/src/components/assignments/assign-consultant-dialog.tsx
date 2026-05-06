"use client";

import { useEffect, useState } from "react";

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
import { toastSuccess } from "@/lib/toast";
import { assignConsultant, reassignConsultant } from "@/lib/api/assignments";
import { listAssignableWorkflowUsers } from "@/lib/api/users";
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
  const [consultants, setConsultants] = useState<UserOut[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setComment("");
    setDeadline("");
    setConsultantId("");
    let cancelled = false;
    (async () => {
      try {
        const items = await listAssignableWorkflowUsers();
        if (!cancelled) setConsultants(items);
      } catch {
        if (!cancelled) setConsultants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, departmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cid = Number(consultantId);
    if (!cid) {
      setError("Select a consultant.");
      return;
    }
    if (!deadline.trim()) {
      setError("Deadline is required.");
      return;
    }
    let deadlineIso: string;
    try {
      deadlineIso = toIsoDeadline(deadline);
    } catch {
      setError("Invalid deadline.");
      return;
    }
    setPending(true);
    try {
      if (mode === "assign") {
        await assignConsultant(letterId, {
          consultant_id: cid,
          deadline_at: deadlineIso,
          comment: comment.trim() || "—",
        });
      } else {
        await reassignConsultant(letterId, {
          consultant_id: cid,
          deadline_at: deadlineIso,
          comment: comment.trim() || "—",
        });
      }
      toastSuccess(mode === "assign" ? "Consultant assigned successfully." : "Consultant reassigned successfully.");
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
            <DialogTitle>
              {mode === "assign" ? "Assign / Forward letter" : "Reassign / Forward letter"}
            </DialogTitle>
            <DialogDescription>
              Choose any active Consultant or Team Leader from any department.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="consultant">Assign To</Label>
              <select
                id="consultant"
                title="Assign To"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={consultantId}
                onChange={(e) => setConsultantId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {consultants.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.roles.map((r) => r.name).join(", ")} — {u.department?.name ?? "No Department"} — {u.email}
                  </option>
                ))}
              </select>
            </div>

            <FormField id="deadline" label="Deadline" error={null}>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </FormField>

            <FormField id="comment" label="Comment" error={null}>
              <Input
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional note"
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "assign" ? "Assign" : "Reassign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
