"use client";

import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  approveLetter,
  rejectLetter,
  returnLetter,
  routeLetter,
} from "@/lib/api/workflow";
import type { DepartmentOut } from "@/types/user";

export type WorkflowActionMode = "approve" | "reject" | "return" | "route";

type WorkflowActionDialogProps = {
  letterId: number;
  mode: WorkflowActionMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentOut[];
  onSuccess: () => void;
};

export function WorkflowActionDialog({
  letterId,
  mode,
  open,
  onOpenChange,
  departments,
  onSuccess,
}: WorkflowActionDialogProps) {
  const [comment, setComment] = useState("");
  const [targetDept, setTargetDept] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles: Record<WorkflowActionMode, string> = {
    approve: "Approve letter",
    reject: "Reject letter",
    return: "Return for correction",
    route: "Route to department",
  };

  async function submit() {
    setError(null);
    if (comment.trim().length < 2) {
      setError("Comment must be at least 2 characters.");
      return;
    }
    if (mode === "route" && !targetDept) {
      setError("Select a target department.");
      return;
    }
    setPending(true);
    try {
      if (mode === "approve") await approveLetter(letterId, comment.trim());
      else if (mode === "reject") await rejectLetter(letterId, comment.trim());
      else if (mode === "return") await returnLetter(letterId, comment.trim());
      else
        await routeLetter(
          letterId,
          Number(targetDept),
          comment.trim()
        );
      onOpenChange(false);
      setComment("");
      setTargetDept("");
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
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>
            {mode === "route"
              ? "Move the letter to another department with a short justification."
              : "This action is recorded on the letter timeline."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {mode === "route" ? (
            <div className="grid gap-2">
              <Label htmlFor="target-dept">Target department</Label>
              <select
                id="target-dept"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
              >
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <FormField id="wf-comment" label="Comment" error={null}>
            <textarea
              id="wf-comment"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              minLength={2}
              required
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void submit()}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
