"use client";

import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  addFinalComment,
  closeIssue,
  reviewSolution,
} from "@/lib/api/closure";

type ClosurePanelProps = {
  letterId: number;
  onChanged: () => void;
  /** Combined consultant resolution notes / file upload captions for TL review */
  consultantSolutionSummary: string | null;
  /** True after "Review solution" step completed */
  solutionReviewed: boolean;
  /** Step 1 — matches backend ``closure:review`` */
  canReviewSolution: boolean;
  /** Step 2 — matches backend ``closure:review`` */
  canSaveFinalRemark: boolean;
  /** Step 3 — matches backend ``closure:close`` */
  canOfficialClose: boolean;
  approvalNote?: {
    comment: string;
    actor: string;
    department: string;
    timestamp: string;
  } | null;
  teamLeaderNote?: {
    comment: string;
    actor: string;
    assignedTo: string;
    timestamp: string;
  } | null;
  consultantNote?: {
    note: string | null;
    hasFile: boolean;
    resolvedBy: string;
    resolvedAt: string;
    workStatus?: string;
  } | null;
  /** True when active assignment is resolved / has note / file — matches backend closure preconditions */
  consultantWorkEvidenceReady?: boolean;
};

export function ClosurePanel({
  letterId,
  onChanged,
  consultantSolutionSummary,
  solutionReviewed,
  canReviewSolution,
  canSaveFinalRemark,
  canOfficialClose,
  approvalNote = null,
  teamLeaderNote = null,
  consultantNote = null,
  consultantWorkEvidenceReady = false,
}: ClosurePanelProps) {
  const [review, setReview] = useState("");
  const [finalC, setFinalC] = useState("");
  const [closeC, setCloseC] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  async function run(
    key: string,
    fn: () => Promise<unknown>,
    reset: () => void
  ) {
    setErr(null);
    setMsg(null);
    setBusy(key);
    try {
      await fn();
      reset();
      const ok =
        key === "review"
          ? "Solution review submitted."
          : key === "final"
            ? "Final remark saved."
            : "Letter officially closed successfully.";
      setMsg("Saved.");
      toastSuccess(ok);
      onChanged();
    } catch (e) {
      const m = getApiErrorMessage(e);
      setErr(m);
      toastError(m);
    } finally {
      setBusy(null);
    }
  }

  const hasSolutionEvidence = Boolean(
    consultantSolutionSummary?.trim() || consultantWorkEvidenceReady
  );

  return (
    <Card id="closure" className="border-[#d7e6f6]">
      <CardHeader>
        <CardTitle className="text-base text-[#123f63]">Closure and final review</CardTitle>
        <p className="text-muted-foreground text-sm">
          For Team Leaders and System Admins. Confirm the consultant&apos;s solution, record your
          review, optionally add remarks, then formally close the letter. The full audit trail is
          preserved.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {err ? (
          <p className="text-destructive text-sm" role="alert">
            {err}
          </p>
        ) : null}
        {!canReviewSolution && !canSaveFinalRemark && !canOfficialClose ? (
          <p className="text-muted-foreground rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            You can view closure records here but do not have permission to submit closure actions.
          </p>
        ) : null}
        {msg ? (
          <p className="text-emerald-700 text-sm dark:text-emerald-400">{msg}</p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-xs">
            <p className="font-semibold text-[#123f63]">Approval Head-PEC Note</p>
            {approvalNote ? (
              <div className="mt-2 space-y-1">
                <p className="whitespace-pre-wrap">{approvalNote.comment}</p>
                <p>
                  <span className="font-medium">Approved by:</span> {approvalNote.actor}
                </p>
                <p>
                  <span className="font-medium">Assigned department:</span> {approvalNote.department}
                </p>
                <p>{new Date(approvalNote.timestamp).toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">No approval note recorded.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-xs">
            <p className="font-semibold text-[#123f63]">Team Leader Note</p>
            {teamLeaderNote ? (
              <div className="mt-2 space-y-1">
                <p className="whitespace-pre-wrap">{teamLeaderNote.comment}</p>
                <p>
                  <span className="font-medium">Assigned to:</span> {teamLeaderNote.assignedTo}
                </p>
                <p>
                  <span className="font-medium">Assigned by:</span> {teamLeaderNote.actor}
                </p>
                <p>{new Date(teamLeaderNote.timestamp).toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">No team leader note recorded.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-xs">
            <p className="font-semibold text-[#123f63]">Consultant Solution Note</p>
            {consultantNote ? (
              <div className="mt-2 space-y-1">
                <p className="whitespace-pre-wrap">
                  {consultantNote.note?.trim()
                    ? consultantNote.note
                    : consultantNote.workStatus === "resolved"
                      ? "No separate solution note saved — assignment marked as resolved (see workflow timeline for status-update comments)."
                      : "No text note."}
                </p>
                <p>
                  <span className="font-medium">Uploaded file:</span>{" "}
                  {consultantNote.hasFile ? "Yes" : "No"}
                </p>
                <p>
                  <span className="font-medium">Resolved by:</span> {consultantNote.resolvedBy}
                </p>
                <p>{new Date(consultantNote.resolvedAt).toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">No consultant solution recorded.</p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
          <h4 className="text-sm font-medium text-[#123f63]">Consultant solution (read-only)</h4>
          {hasSolutionEvidence ? (
            consultantSolutionSummary?.trim() ? (
              <pre className="text-foreground max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-white p-3 font-sans text-sm">
                {consultantSolutionSummary}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">
                Consultant work is on record as resolved (or has evidence on the assignment).
                Review the workflow timeline on the left for full comments. You may proceed after Step
                1 if satisfied.
              </p>
            )
          ) : (
            <p className="text-muted-foreground text-sm">
              No resolution note or solution file activity is recorded yet. The consultant should
              mark the assignment resolved, add a solution note, or upload a solution file before
              closure can proceed.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Step 1 — Review solution</h4>
          <p className="text-muted-foreground text-xs">
            Confirm you have reviewed the attachment, the consultant&apos;s notes above, and any
            uploaded solution files. Your comment is stored in the workflow history.
          </p>
          {solutionReviewed ? (
            <p className="text-emerald-800 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              Solution review is on record. You may add an optional final remark and proceed to
              close.
            </p>
          ) : null}
          <FormField id="review_comment" label="Review comment" error={null}>
            <textarea
              id="review_comment"
              title="Solution review comment"
              placeholder="Record your review (minimum 3 characters)…"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              minLength={3}
              disabled={solutionReviewed}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
              disabled={busy !== null || review.trim().length < 3 || solutionReviewed || !canReviewSolution}
            onClick={() =>
              void run("review", () => reviewSolution(letterId, review.trim()), () => setReview(""))
            }
          >
            {busy === "review" ? "Saving…" : solutionReviewed ? "Review already recorded" : "Submit solution review"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Step 2 — Final remark (optional)</h4>
          <p className="text-muted-foreground text-xs">
            Add any additional closure remarks. This is optional if you prefer to put everything in
            the closing step.
          </p>
          <FormField id="final_comment" label="Final remark" error={null}>
            <textarea
              id="final_comment"
              title="Final remark before close"
              placeholder="Optional remark (minimum 3 characters)…"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={finalC}
              onChange={(e) => setFinalC(e.target.value)}
              minLength={3}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null || finalC.trim().length < 3 || !canSaveFinalRemark}
            onClick={() =>
              void run("final", () => addFinalComment(letterId, finalC.trim()), () => setFinalC(""))
            }
          >
            {busy === "final" ? "Saving…" : "Save final remark"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Step 3 — Close letter</h4>
          <p className="text-muted-foreground text-xs">
            Formal closure locks workflow actions and keeps the full history for reports. Solution
            review (step 1) is required before the system accepts closure.
          </p>
          <FormField id="close_comment" label="Final closure comment" error={null}>
            <textarea
              id="close_comment"
              title="Final closure comment"
              placeholder="Closing summary for the audit trail (minimum 3 characters)…"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={closeC}
              onChange={(e) => setCloseC(e.target.value)}
              minLength={3}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            disabled={
              busy !== null ||
              closeC.trim().length < 3 ||
              !hasSolutionEvidence ||
              !canOfficialClose
            }
            onClick={() => setConfirmCloseOpen(true)}
          >
            Closed
          </Button>
          {!hasSolutionEvidence ? (
            <p className="text-amber-800 text-xs">
              Consultant must resolve the assignment or provide a solution note / file before closure.
            </p>
          ) : null}
          {!canOfficialClose ? (
            <p className="text-muted-foreground text-xs">
              Final closure requires the Close permission (typically Team Leader or System Admin).
            </p>
          ) : null}
        </div>
      </CardContent>

      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm official closure</DialogTitle>
            <DialogDescription>
              Are you sure you want to officially close this letter?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">Final closure comment</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{closeC.trim() || "—"}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                busy !== null ||
                closeC.trim().length < 3 ||
                !hasSolutionEvidence ||
                !canOfficialClose
              }
              onClick={() => {
                void run("close", () => closeIssue(letterId, closeC.trim()), () => {
                  setCloseC("");
                  setConfirmCloseOpen(false);
                });
              }}
            >
              {busy === "close" ? "Closing…" : "Closed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
