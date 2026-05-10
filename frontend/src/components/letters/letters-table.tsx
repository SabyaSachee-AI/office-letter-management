"use client";

import Link from "next/link";
import { useState } from "react";

import { LetterAttachmentPreviewButton } from "@/components/attachments/letter-attachment-preview-button";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { LetterPriorityBadge, VisibleWorkflowStatusBadge } from "@/components/letters/letter-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { userHasPermission } from "@/lib/auth/permissions";
import { getVisibleWorkflowStatus } from "@/lib/workflow-display";
import { cn } from "@/lib/utils";
import type { LetterOut } from "@/types/letter";

type LettersTableProps = {
  letters: LetterOut[];
  loading: boolean;
  /**
   * When false (e.g. Reports), serial is plain text and View opens attachment preview only —
   * avoids navigating to letter detail (which requires letters:view / consultant access).
   */
  linkLetterDetail?: boolean;
  /**
   * When `linkLetterDetail` is true, serial and View use this URL (e.g. Assignment module route).
   * Defaults to `/dashboard/letters/[id]`.
   */
  getLetterDetailHref?: (letter: LetterOut) => string;
  /** Optional action column (e.g. Assign) */
  renderRowAction?: (letter: LetterOut) => React.ReactNode;
};

export function LettersTable({
  letters,
  loading,
  linkLetterDetail = true,
  getLetterDetailHref,
  renderRowAction,
}: LettersTableProps) {
  const { user } = useAuth();
  const [quickView, setQuickView] = useState<LetterOut | null>(null);
  const canOpenFullLetter =
    !!user &&
    (userHasPermission(user, "letters:view") ||
      userHasPermission(user, "letters:create") ||
      userHasPermission(user, "consultant:view"));

  const detailHref = (l: LetterOut) =>
    getLetterDetailHref ? getLetterDetailHref(l) : `/dashboard/letters/${l.id}`;

  const columns: DataTableColumn<LetterOut>[] = [
    {
      id: "serial",
      header: "Serial",
      cell: (l) =>
        linkLetterDetail ? (
          <Link href={detailHref(l)} className="text-primary font-medium hover:underline">
            {l.serial_no}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{l.serial_no}</span>
        ),
    },
    {
      id: "memo_no",
      header: "Memo No",
      className: "max-w-[140px]",
      cell: (l) => (
        <span className="text-muted-foreground text-sm">
          {l.memo_no?.trim() ? l.memo_no : "—"}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      cell: (l) => (
        <div className="max-w-[240px] truncate text-sm">{l.subject}</div>
      ),
    },
    {
      id: "from",
      header: "From",
      cell: (l) => (
        <span className="text-muted-foreground max-w-[160px] truncate text-sm">
          {l.received_from}
        </span>
      ),
    },
    {
      id: "dept",
      header: "Department",
      cell: (l) => (
        <span className="text-sm">
          {l.department ? `${l.department.name} (${l.department.code})` : "Pending Assignment"}
        </span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      cell: (l) => <LetterPriorityBadge priority={l.priority} />,
    },
    {
      id: "status",
      header: "Status",
      cell: (l) => {
        const visible = getVisibleWorkflowStatus(l, l.latest_assignment ?? null);
        return (
          <div className="space-y-1">
            <VisibleWorkflowStatusBadge letter={l} latestAssignment={l.latest_assignment ?? null} />
            <p className="text-muted-foreground text-[11px]">{visible.currentHolderLabel}</p>
          </div>
        );
      },
    },
    {
      id: "attachment",
      header: "File",
      className: "w-14 text-center",
      cell: (l) => (
        <LetterAttachmentPreviewButton
          letterId={l.id}
          filePathHint={l.pdf_path}
          label=""
          size="icon-sm"
          variant="ghost"
          className="text-[#123f63] hover:bg-slate-100"
        />
      ),
    },
    {
      id: "view",
      header: "View",
      className: "w-20 text-right",
      cell: (l) =>
        linkLetterDetail ? (
          <Link
            href={detailHref(l)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View
          </Link>
        ) : (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setQuickView(l)}>
            View
          </Button>
        ),
    },
  ];

  if (renderRowAction) {
    columns.push({
      id: "row",
      header: "",
      className: "w-28 text-right",
      cell: (l) => renderRowAction(l),
    });
  }

  const qvVisible = !linkLetterDetail && quickView !== null;
  const qv = quickView;

  return (
    <>
      <DataTable
        columns={columns}
        data={letters}
        getRowKey={(l) => l.id}
        isLoading={loading}
        emptyContent={
          <EmptyState
            title="No letters"
            description="Create a letter from Receive, or adjust filters."
            action={
              <Link
                href="/dashboard/letters/receive"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Receive letter
              </Link>
            }
          />
        }
      />

      <Dialog open={qvVisible} onOpenChange={(open) => !open && setQuickView(null)}>
        {qv ? (
          <DialogContent className="max-w-lg" showCloseButton>
            <DialogHeader>
              <DialogTitle>Letter summary</DialogTitle>
              <p className="text-muted-foreground text-sm">
                Read-only snapshot for this report. Use the File column to preview the attachment when your role
                allows it.
              </p>
            </DialogHeader>
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Serial:</span> {qv.serial_no}
              </p>
              <p>
                <span className="text-muted-foreground">Memo:</span> {qv.memo_no?.trim() || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Subject:</span> {qv.subject}
              </p>
              <p>
                <span className="text-muted-foreground">From:</span> {qv.received_from}
              </p>
              <p>
                <span className="text-muted-foreground">Department:</span>{" "}
                {qv.department ? `${qv.department.name} (${qv.department.code})` : "—"}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Priority:</span>
                <LetterPriorityBadge priority={qv.priority} />
              </p>
              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <VisibleWorkflowStatusBadge letter={qv} latestAssignment={qv.latest_assignment ?? null} />
                <p className="text-muted-foreground mt-1 text-xs">
                  {getVisibleWorkflowStatus(qv, qv.latest_assignment ?? null).currentHolderLabel}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {canOpenFullLetter ? (
                <Link
                  href={`/dashboard/letters/${qv.id}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                  onClick={() => setQuickView(null)}
                >
                  Open full letter
                </Link>
              ) : (
                <span className="text-muted-foreground max-w-xs text-xs">
                  Full workflow and history are available from Letters if your account has letter access.
                </span>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickView(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
