"use client";

import Link from "next/link";

import { LetterAttachmentPreviewButton } from "@/components/attachments/letter-attachment-preview-button";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { LetterPriorityBadge, LetterStatusBadge } from "@/components/letters/letter-badges";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LetterOut } from "@/types/letter";

type LettersTableProps = {
  letters: LetterOut[];
  loading: boolean;
  /** Optional action column (e.g. Assign) */
  renderRowAction?: (letter: LetterOut) => React.ReactNode;
};

export function LettersTable({
  letters,
  loading,
  renderRowAction,
}: LettersTableProps) {
  const columns: DataTableColumn<LetterOut>[] = [
    {
      id: "serial",
      header: "Serial",
      cell: (l) => (
        <Link
          href={`/dashboard/letters/${l.id}`}
          className="text-primary font-medium hover:underline"
        >
          {l.serial_no}
        </Link>
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
      cell: (l) => <LetterStatusBadge status={l.status} />,
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
      cell: (l) => (
        <Link
          href={`/dashboard/letters/${l.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View
        </Link>
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

  return (
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
  );
}
