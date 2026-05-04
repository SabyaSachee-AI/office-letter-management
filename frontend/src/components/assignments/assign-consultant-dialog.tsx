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
import { assignConsultant, reassignConsultant } from "@/lib/api/assignments";
import { fetchRoles, listUsers } from "@/lib/api/users";
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
        const roles = await fetchRoles();
        const consultantRole = roles.find((r) => r.name === "Consultant");
        if (!consultantRole) {
          setConsultants([]);
          return;
        }
        const res = await listUsers({
          role_id: consultantRole.id,
          department_id: departmentId,
          status: "active",
          limit: 100,
        });
        if (!cancelled) setConsultants(res.items);
      } catch {
        if (!cancelled) setConsultants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, departmentId]);

  async function submit() {
    setError(null);
    if (!consultantId || !deadline || comment.trim().length < 2) {
      setError("Select consultant, deadline, and a comment (min 2 characters).");
      return;
    }
    setPending(true);
    try {
      const body = {
        consultant_id: Number(consultantId),
        deadline_at: toIsoDeadline(deadline),
        comment: comment.trim(),
      };
      if (mode === "assign") {
        await assignConsultant(letterId, body);
      } else {
        await reassignConsultant(letterId, body);
      }
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {mode === "assign" ? "Assign consultant" : "Reassign consultant"}
          </DialogTitle>
          <DialogDescription>
            Choose a consultant in the same department as the letter and set a
            deadline.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="consultant">Consultant</Label>
            <select
              id="consultant"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={consultantId}
              onChange={(e) => setConsultantId(e.target.value)}
            >
              <option value="">Select…</option>
              {consultants.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deadline">Deadline (local time)</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>
          <FormField id="assign-comment" label="Comment" error={null}>
            <Input
              id="assign-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              minLength={2}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void submit()}>
            {pending ? "Saving…" : mode === "assign" ? "Assign" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
