"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ActionHistoryCard } from "@/components/letters/action-history-list";
import { LetterPriorityBadge, LetterStatusBadge } from "@/components/letters/letter-badges";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchLetterAttachmentBlob, getLetter, getLetterActionHistory } from "@/lib/api/letters";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { approveLetter, rejectLetter } from "@/lib/api/workflow";
import { fetchDepartments } from "@/lib/api/users";
import type { ClosureHistoryResponse, LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

export function ApprovalReviewPage({ letterId }: { letterId: number }) {
  type PendingAction = "assign" | "approve" | "reject";
  type ViewerMode = "fitWidth" | "fitPage";

  const [letter, setLetter] = useState<LetterOut | null>(null);
  const [history, setHistory] = useState<ClosureHistoryResponse | null>(null);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [pending, setPending] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("fitWidth");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPreviewError(null);
    try {
      const [l, h, d, blob] = await Promise.all([
        getLetter(letterId),
        getLetterActionHistory(letterId),
        fetchDepartments({ excludeLegacy: true }),
        fetchLetterAttachmentBlob(letterId),
      ]);
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setLetter(l);
      setHistory(h);
      setDepartments(d);
      setPriority(l.priority);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setLetter(null);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    void load();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileName = useMemo(() => letter?.pdf_path.split(/[\\/]/).pop() ?? "attachment", [letter]);
  const lowerName = (fileName || "").toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => lowerName.endsWith(ext));
  const isPdf = lowerName.endsWith(".pdf");

  function canSubmitReviewNote(): boolean {
    return note.trim().length >= 2;
  }

  function requestConfirm(action: PendingAction) {
    setPendingAction(action);
    setConfirmOpen(true);
  }

  async function executeAction() {
    if (!pendingAction) return;
    const selectedDepartmentId = departmentId ? Number(departmentId) : letter?.department?.id;
    if ((pendingAction === "assign" || pendingAction === "approve") && !selectedDepartmentId) {
      setLoadError("Select department before this action.");
      return;
    }
    if (!canSubmitReviewNote()) {
      setLoadError("Workflow Note must be at least 2 characters.");
      return;
    }
    setPending(true);
    try {
      if (pendingAction === "reject") {
        await rejectLetter(letterId, note.trim());
      } else {
        await approveLetter(letterId, note.trim(), selectedDepartmentId, priority);
      }
      window.location.assign("/dashboard/approval");
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
    } finally {
      setPending(false);
      setConfirmOpen(false);
      setPendingAction(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading review screen...</p>;
  if (loadError || !letter || !history) return <ErrorBanner message={loadError ?? "Failed to load review"} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Review Letter: ${letter.serial_no}`}
        description="Review full attachment, write Workflow Note, assign department, and submit decision."
        actions={
          <Link
            href="/dashboard/approval"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Back to Queue
          </Link>
        }
      />

      <div className="grid gap-4 rounded-xl border border-[#d7e6f6] bg-[#f8fbff] p-4 lg:grid-cols-3">
        <div className="text-sm"><span className="font-medium">Serial No:</span> {letter.serial_no}</div>
        <div className="text-sm"><span className="font-medium">Memo No:</span> {letter.memo_no || "—"}</div>
        <div className="text-sm"><span className="font-medium">From Office:</span> {letter.received_from}</div>
        <div className="text-sm"><span className="font-medium">Received Date:</span> {new Date(letter.created_at).toLocaleString()}</div>
        <div className="text-sm flex items-center gap-2"><span className="font-medium">Status:</span> <LetterStatusBadge status={letter.status} /></div>
        <div className="text-sm flex items-center gap-2"><span className="font-medium">Priority:</span> <LetterPriorityBadge priority={letter.priority} /></div>
        <div className="text-sm lg:col-span-3"><span className="font-medium">Subject:</span> {letter.subject}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[#123f63]">Attachment Preview</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                Zoom Out
              </Button>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>
                Zoom In
              </Button>
              <Button
                size="sm"
                variant={viewerMode === "fitWidth" ? "secondary" : "outline"}
                onClick={() => setViewerMode("fitWidth")}
              >
                Fit Width
              </Button>
              <Button
                size="sm"
                variant={viewerMode === "fitPage" ? "secondary" : "outline"}
                onClick={() => setViewerMode("fitPage")}
              >
                Fit Page
              </Button>
              {blobUrl ? (
                <>
                  <a href={blobUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                    Open in New Tab
                  </a>
                  <a href={blobUrl} download={fileName} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                    Download
                  </a>
                </>
              ) : null}
            </div>
          </div>
          <div
            className={cn(
              "overflow-auto rounded-md border bg-slate-50 p-2",
              viewerMode === "fitPage" ? "h-[78vh]" : "min-h-[620px] h-[78vh]"
            )}
          >
            {previewError ? <ErrorBanner message={previewError} /> : null}
            {blobUrl && isPdf ? (
              <iframe
                title="Letter attachment PDF preview"
                src={blobUrl}
                className={cn(
                  "origin-top-left rounded border",
                  viewerMode === "fitPage" ? "mx-auto h-full w-[80%]" : "h-[1200px] w-full"
                )}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              />
            ) : null}
            {blobUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blobUrl}
                alt="Letter attachment"
                className={cn(
                  "rounded",
                  viewerMode === "fitPage" ? "mx-auto max-h-[72vh] w-auto" : "w-full"
                )}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              />
            ) : null}
            {blobUrl && !isPdf && !isImage ? (
              <p className="p-4 text-sm text-slate-600">
                DOC/DOCX preview is not embedded. Use Open/Download to review the file.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="space-y-3 rounded-xl border bg-white p-4 lg:sticky lg:top-20 lg:h-fit">
          <h3 className="font-semibold text-[#123f63]">Review Action Panel</h3>
          <p className="text-xs text-slate-500">
            Future-ready: this panel is structured to support annotation metadata overlays later without changing original files.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="review-note">Workflow Note</Label>
            <textarea
              id="review-note"
              title="Workflow Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Write workflow note..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assign-department">Assign Department</Label>
            <select
              id="assign-department"
              title="Assign Department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              title="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high" | "urgent")}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button disabled={pending || !departmentId || !canSubmitReviewNote()} onClick={() => requestConfirm("assign")}>
              Assign Department
            </Button>
            <Button disabled={pending || !canSubmitReviewNote()} onClick={() => requestConfirm("approve")}>
              Approve
            </Button>
            <Button disabled={pending || !canSubmitReviewNote()} variant="destructive" onClick={() => requestConfirm("reject")}>
              Reject
            </Button>
            <Link href="/dashboard/approval" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Cancel
            </Link>
          </div>
        </aside>
      </div>

      <ActionHistoryCard title="Workflow History" actions={history.actions} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Workflow Action</DialogTitle>
            <DialogDescription>
              Review the summary before final submission.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-slate-50 p-3 text-sm">
            <p>
              <span className="font-medium">Action: </span>
              {pendingAction === "assign" ? "Assign Department" : pendingAction === "approve" ? "Approve" : "Reject"}
            </p>
            <p>
              <span className="font-medium">Assign to: </span>
              {departments.find((d) => String(d.id) === departmentId)?.name || letter.department?.name || "—"}
            </p>
            <p className="whitespace-pre-wrap">
              <span className="font-medium">Workflow Note: </span>
              {note || "—"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => void executeAction()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
