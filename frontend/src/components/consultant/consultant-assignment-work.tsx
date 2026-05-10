"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AssignmentRecipientSummary } from "@/components/letters/assignment-recipient-summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import { userHasPermission } from "@/lib/auth/permissions";
import {
  addResolutionNote,
  transferAssignment,
  updateAssignmentStatus,
  uploadSolutionFile,
} from "@/lib/api/consultant";
import { listAssignableWorkflowUsers } from "@/lib/api/users";
import { assignForwardRecipientLabel, primaryWorkflowRoleLabel } from "@/lib/workflow-user-label";
import type { ConsultantAssignmentRow, LetterStatus } from "@/types/letter";
import type { UserOut } from "@/types/user";
import { cn } from "@/lib/utils";

type ConsultantAssignmentWorkProps = {
  row: ConsultantAssignmentRow;
  departmentId: number;
  /** Letter lifecycle status — blocks transfer when closed or rejected */
  letterStatus?: LetterStatus;
  onUpdated: () => void;
  /** Latest Team Leader comment from workflow (letter detail sidebar) */
  teamLeaderComment?: string | null;
};

export function ConsultantAssignmentWork({
  row,
  departmentId,
  letterStatus,
  onUpdated,
  teamLeaderComment = null,
}: ConsultantAssignmentWorkProps) {
  const { user } = useAuth();
  const canTransfer = userHasPermission(user, "consultant:transfer");
  const aid = row.assignment.id;
  const [resolveComment, setResolveComment] = useState("");
  const [resNote, setResNote] = useState("");
  const [resComment, setResComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileComment, setFileComment] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferComment, setTransferComment] = useState("");
  const [transferDeadline, setTransferDeadline] = useState("");
  const [peers, setPeers] = useState<UserOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listAssignableWorkflowUsers();
        const others = items.filter((u) => u.id !== row.assignment.consultant_id);
        if (!cancelled) setPeers(others);
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId, row.assignment.consultant_id]);

  const transferBlockedByLetter = letterStatus === "closed" || letterStatus === "rejected";
  const transferDisabled =
    row.assignment.work_status === "resolved" ||
    transferBlockedByLetter ||
    !canTransfer;

  async function submit(
    fn: () => Promise<unknown>,
    reset: (() => void) | undefined,
    successMessage: string
  ) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      reset?.();
      toastSuccess(successMessage);
      onUpdated();
    } catch (e) {
      const m = getApiErrorMessage(e);
      setErr(m);
      toastError(m);
    } finally {
      setBusy(false);
    }
  }

  const letterDept = row.letter_department ?? null;

  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60">
      <div className="space-y-1 border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#123f63]">
            Consultant — {row.serial_no}
          </h3>
          <Link
            href="/dashboard/consultant"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 shrink-0 text-xs")}
          >
            Back to workspace
          </Link>
        </div>
        <p className="text-muted-foreground text-[11px]">
          {row.deadline_at
            ? `Deadline: ${new Date(row.deadline_at).toLocaleString()} · `
            : "No deadline set · "}
          Assignment #{aid}
        </p>
        <p className="text-muted-foreground text-[11px] leading-snug">{row.subject}</p>
      </div>
      <div className="space-y-4 px-4 pb-5 pt-4 text-sm">
        <AssignmentRecipientSummary
          assignment={row.assignment}
          letterDepartment={letterDept}
          teamLeaderComment={teamLeaderComment}
        />

        {err ? (
          <p className="text-destructive" role="alert">
            {err}
          </p>
        ) : null}

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#123f63]">Your actions</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Add a solution note, upload evidence, mark the assignment resolved, or transfer /
            forward to another Consultant or Team Leader when permitted. Prior notes remain in the
            workflow history under the attachment.
          </p>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-800">Consultant solution note / remark</h4>
            <textarea
              className="border-input min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Resolution details (min 3 characters)"
              value={resNote}
              onChange={(e) => setResNote(e.target.value)}
            />
            <Input
              placeholder="Timeline comment (min 2 characters)"
              value={resComment}
              onChange={(e) => setResComment(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={
                busy ||
                resNote.trim().length < 3 ||
                resComment.trim().length < 2 ||
                row.assignment.work_status === "resolved"
              }
              onClick={() =>
                void submit(
                  () => addResolutionNote(aid, resNote.trim(), resComment.trim()),
                  () => {
                    setResNote("");
                    setResComment("");
                  },
                  "Solution note saved."
                )
              }
            >
              Save solution note
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Upload solution file (optional)</h4>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Input
              placeholder="Upload comment (min 2 characters)"
              value={fileComment}
              onChange={(e) => setFileComment(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={
                busy ||
                !file ||
                fileComment.trim().length < 2 ||
                row.assignment.work_status === "resolved"
              }
              onClick={() => {
                if (!file) return;
                const fd = new FormData();
                fd.append("comment", fileComment.trim());
                fd.append("file", file);
                void submit(
                  () => uploadSolutionFile(aid, fd),
                  () => {
                    setFile(null);
                    setFileComment("");
                  },
                  "Solution file uploaded."
                );
              }}
            >
              Upload
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Mark as resolved</h4>
            <Input
              placeholder="Resolution summary for workflow (min 2 characters)"
              value={resolveComment}
              onChange={(e) => setResolveComment(e.target.value)}
            />
            <Button
              size="sm"
              disabled={
                busy ||
                resolveComment.trim().length < 2 ||
                row.assignment.work_status === "resolved"
              }
              onClick={() =>
                void submit(
                  () => updateAssignmentStatus(aid, "resolved", resolveComment.trim()),
                  () => setResolveComment(""),
                  "Marked as resolved."
                )
              }
            >
              Mark as resolved
            </Button>
          </div>

          <Separator />

          {canTransfer ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-800">Assign / Forward</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Send this letter to any active Team Leader or Consultant in any department. A
                workflow note is required. Deadline is optional. You cannot forward when the letter is
                closed or rejected.
              </p>
              {transferBlockedByLetter && letterStatus ? (
                <p className="text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs">
                  Transfers are disabled because this letter is {letterStatus}.
                </p>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="consult-transfer-to" className="text-xs font-medium">
                  Recipient
                </Label>
                <select
                  id="consult-transfer-to"
                  title="Recipient"
                  className="border-input h-9 w-full max-w-md rounded-md border px-2 text-sm"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  disabled={transferDisabled}
                >
                  <option value="">Select recipient…</option>
                  {peers.filter((u) => primaryWorkflowRoleLabel(u) === "Team Leader").length > 0 ? (
                    <optgroup label="Team Leaders">
                      {peers
                        .filter((u) => primaryWorkflowRoleLabel(u) === "Team Leader")
                        .map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {assignForwardRecipientLabel(u)}
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                  {peers.filter((u) => primaryWorkflowRoleLabel(u) === "Consultant").length > 0 ? (
                    <optgroup label="Consultants">
                      {peers
                        .filter((u) => primaryWorkflowRoleLabel(u) === "Consultant")
                        .map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {assignForwardRecipientLabel(u)}
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="consult-transfer-deadline" className="text-xs font-medium">
                  Deadline (optional)
                </Label>
                <Input
                  id="consult-transfer-deadline"
                  type="datetime-local"
                  title="Deadline"
                  className="border-input h-9 max-w-md"
                  value={transferDeadline}
                  onChange={(e) => setTransferDeadline(e.target.value)}
                  disabled={transferDisabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="consult-transfer-note" className="text-xs font-medium">
                  Workflow note / comment
                </Label>
                <textarea
                  id="consult-transfer-note"
                  title="Workflow note"
                  className="border-input min-h-[88px] w-full max-w-md rounded-md border px-3 py-2 text-sm"
                  placeholder="Required (min 2 characters)…"
                  value={transferComment}
                  onChange={(e) => setTransferComment(e.target.value)}
                  disabled={transferDisabled}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busy ||
                  !transferTo ||
                  transferComment.trim().length < 2 ||
                  transferDisabled
                }
                onClick={() =>
                  void submit(
                    () => {
                      let dl: string | null | undefined;
                      if (transferDeadline.trim()) {
                        const d = new Date(transferDeadline);
                        if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline.");
                        dl = d.toISOString();
                      } else {
                        dl = undefined;
                      }
                      return transferAssignment(aid, Number(transferTo), transferComment.trim(), dl);
                    },
                    () => {
                      setTransferTo("");
                      setTransferComment("");
                      setTransferDeadline("");
                    },
                    "Forward completed."
                  )
                }
              >
                Forward
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
