"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { AssignmentStatusBadge } from "@/components/letters/letter-badges";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConsultantAssignmentRow } from "@/types/letter";

type ConsultantAssignmentsTableProps = {
  rows: ConsultantAssignmentRow[];
  loading: boolean;
};

export function ConsultantAssignmentsTable({ rows, loading }: ConsultantAssignmentsTableProps) {
  const columns: DataTableColumn<ConsultantAssignmentRow>[] = [
    {
      id: "serial",
      header: "Serial",
      cell: (row) => (
        <Link
          href={`/dashboard/letters/${row.letter_id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.serial_no}
        </Link>
      ),
    },
    {
      id: "memo",
      header: "Memo No",
      className: "max-w-[120px]",
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
          {row.memo_no?.trim() ? row.memo_no : "—"}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      cell: (row) => (
        <div className="max-w-[200px] truncate text-sm" title={row.subject}>
          {row.subject}
        </div>
      ),
    },
    {
      id: "from",
      header: "From office",
      cell: (row) => (
        <span className="text-muted-foreground max-w-[140px] truncate text-sm">
          {row.received_from}
        </span>
      ),
    },
    {
      id: "dept",
      header: "Department",
      cell: (row) => (
        <span className="text-sm">
          {row.letter_department
            ? `${row.letter_department.name} (${row.letter_department.code})`
            : "—"}
        </span>
      ),
    },
    {
      id: "by",
      header: "Assigned by",
      cell: (row) => {
        const u = row.assignment.assigned_by_user;
        return (
          <span className="text-sm">
            {u ? `${u.full_name} (${u.roles.join(", ")})` : `User #${row.assignment.assigned_by}`}
          </span>
        );
      },
    },
    {
      id: "time",
      header: "Assigned time",
      cell: (row) => (
        <span className="text-muted-foreground whitespace-nowrap text-sm">
          {new Date(row.assignment.assigned_at).toLocaleString()}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <AssignmentStatusBadge status={row.assignment.work_status} />
      ),
    },
    {
      id: "view",
      header: "View",
      className: "w-20",
      cell: (row) => (
        <Link
          href={`/dashboard/letters/${row.letter_id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(r) => r.assignment.id}
      isLoading={loading}
      emptyContent={
        <EmptyState
          title="No active assignments"
          description="When a team leader assigns you a letter, it will appear in this table. Open View to work the letter on the review screen."
        />
      }
    />
  );
}
