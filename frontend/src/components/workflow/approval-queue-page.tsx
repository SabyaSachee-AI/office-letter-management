"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterPriorityBadge, LetterStatusBadge } from "@/components/letters/letter-badges";
import { WorkflowActionDialog, type WorkflowActionMode } from "@/components/workflow/workflow-action-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { canWorkflowDecide } from "@/lib/auth/roles";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getApprovalQueue } from "@/lib/api/workflow";
import { fetchDepartments } from "@/lib/api/users";
import type { ApprovalQueueItem } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

const PAGE = 20;

export function ApprovalQueuePage() {
  const { user } = useAuth();
  const decide = canWorkflowDecide(user);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [dialog, setDialog] = useState<{
    mode: WorkflowActionMode;
    letterId: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [res, depts] = await Promise.all([
        getApprovalQueue(PAGE, page * PAGE),
        fetchDepartments(),
      ]);
      setItems(res.items);
      setTotal(res.total);
      setDepartments(depts);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<ApprovalQueueItem>[] = [
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
      id: "subject",
      header: "Subject",
      cell: (l) => (
        <div className="max-w-[200px] truncate text-sm">{l.subject}</div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (l) => <LetterStatusBadge status={l.status} />,
    },
    {
      id: "priority",
      header: "Priority",
      cell: (l) => <LetterPriorityBadge priority={l.priority} />,
    },
  ];

  if (decide) {
    columns.push({
      id: "actions",
      header: "",
      className: "w-[220px]",
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="outline" onClick={() => setDialog({ mode: "approve", letterId: l.id })}>
            Approve
          </Button>
          <Button size="xs" variant="outline" onClick={() => setDialog({ mode: "reject", letterId: l.id })}>
            Reject
          </Button>
          <Button size="xs" variant="outline" onClick={() => setDialog({ mode: "return", letterId: l.id })}>
            Return
          </Button>
          <Button size="xs" variant="secondary" onClick={() => setDialog({ mode: "route", letterId: l.id })}>
            Route
          </Button>
        </div>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval queue"
        description="Letters awaiting review in your department (and admin view). Approvers can act from here or open a letter for more context."
      />

      {loadError ? <ErrorBanner message={loadError} /> : null}

      <DataTable
        columns={columns}
        data={items}
        getRowKey={(l) => l.id}
        isLoading={loading}
        emptyContent={
          <EmptyState title="Queue is empty" description="No letters in approval states right now." />
        }
      />

      <PaginationBar page={page} pageSize={PAGE} total={total} onPageChange={setPage} />

      {dialog ? (
        <WorkflowActionDialog
          letterId={dialog.letterId}
          mode={dialog.mode}
          open={Boolean(dialog)}
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          departments={departments}
          onSuccess={() => void load()}
        />
      ) : null}
    </div>
  );
}
