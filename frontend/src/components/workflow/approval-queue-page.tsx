"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterPriorityBadge, VisibleWorkflowStatusBadge } from "@/components/letters/letter-badges";
import { getVisibleWorkflowStatus } from "@/lib/workflow-display";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getApprovalQueue } from "@/lib/api/workflow";
import { APPROVAL_QUEUE_STATUS_OPTIONS } from "@/lib/workflow-display";
import type { ApprovalQueueItem } from "@/types/letter";

const PAGE = 20;

export function ApprovalQueuePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setSearchQ(searchParams.get("q") ?? "");
    setFromOffice(searchParams.get("from_office") ?? "");
    setStatus(searchParams.get("status") ?? "");
    setDateFrom(searchParams.get("date_from") ?? "");
    setDateTo(searchParams.get("date_to") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getApprovalQueue(PAGE, page * PAGE, {
        q: searchQ || undefined,
        from_office: fromOffice || undefined,
        status: status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQ, fromOffice, status, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<ApprovalQueueItem>[] = [
    {
      id: "serial",
      header: "Serial No",
      cell: (l) => (
        <Link
          href={`/dashboard/approval/${l.id}`}
          className="text-primary font-medium hover:underline"
        >
          {l.serial_no}
        </Link>
      ),
    },
    {
      id: "memo_no",
      header: "Memo No",
      cell: (l) => (
        <span className="text-muted-foreground max-w-[120px] truncate text-sm">
          {l.memo_no?.trim() ? l.memo_no : "—"}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      cell: (l) => (
        <div className="max-w-[360px] whitespace-normal text-sm leading-5" title={l.subject}>
          {l.subject}
        </div>
      ),
    },
    {
      id: "from",
      header: "From Office",
      cell: (l) => (
        <span className="max-w-[220px] whitespace-normal text-sm leading-5" title={l.received_from}>
          {l.received_from}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (l) => {
        const visible = getVisibleWorkflowStatus(l);
        return (
          <div className="space-y-1">
            <VisibleWorkflowStatusBadge letter={l} />
            <p className="text-muted-foreground text-[11px]">{visible.currentHolderLabel}</p>
          </div>
        );
      },
    },
    {
      id: "priority",
      header: "Priority",
      cell: (l) => <LetterPriorityBadge priority={l.priority} />,
    },
    {
      id: "received",
      header: "Received Date",
      cell: (l) => (
        <span className="text-sm">{new Date(l.created_at).toLocaleString()}</span>
      ),
    },
    {
      id: "view",
      header: "View",
      className: "w-32",
      cell: (l) => (
        <Link href={`/dashboard/approval/${l.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      ),
    },
  ];

  const STATUS_OPTS = [...APPROVAL_QUEUE_STATUS_OPTIONS];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval queue"
        description="Central review queue for all incoming letters awaiting department assignment. Not limited by user department."
      />

      {loadError ? <ErrorBanner message={loadError} /> : null}

      <LetterFilterBar
        search={searchQ}
        fromOffice={fromOffice}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        department=""
        onSearchChange={setSearchQ}
        onFromOfficeChange={setFromOffice}
        onStatusChange={setStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onDepartmentChange={() => undefined}
        onApply={() => {
          setPage(0);
          const next = new URLSearchParams(searchParams.toString());
          next.set("q", searchQ);
          next.set("from_office", fromOffice);
          next.set("status", status);
          next.set("date_from", dateFrom);
          next.set("date_to", dateTo);
          next.delete("department_id");
          next.set("page", "0");
          router.replace(`${pathname}?${next.toString()}`);
          void load();
        }}
        onReset={() => {
          setSearchQ("");
          setFromOffice("");
          setStatus("");
          setDateFrom("");
          setDateTo("");
          setPage(0);
          router.replace(pathname);
        }}
        statusOptions={STATUS_OPTS}
        showDepartment={false}
      />

      <DataTable
        columns={columns}
        data={items}
        getRowKey={(l) => l.id}
        isLoading={loading}
        emptyContent={
          <EmptyState title="Queue is empty" description="No letters in approval states right now." />
        }
      />

      <PaginationBar
        page={page}
        pageSize={PAGE}
        total={total}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          const next = new URLSearchParams(searchParams.toString());
          next.set("page", String(nextPage));
          router.replace(`${pathname}?${next.toString()}`);
        }}
      />
    </div>
  );
}
