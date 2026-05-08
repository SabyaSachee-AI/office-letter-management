"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { VisibleWorkflowStatusBadge } from "@/components/letters/letter-badges";
import { buttonVariants } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { listLetters } from "@/lib/api/letters";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { isAdmin, workflowDepartmentId } from "@/lib/auth/roles";
import { getVisibleWorkflowStatus } from "@/lib/workflow-display";
import { fetchDepartments } from "@/lib/api/users";
import type { LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

const PAGE = 20;
/** Backend GET /letters allows limit ≤ 100 */
const API_PAGE_LIMIT = 100;

async function fetchAllLettersForClosure(params: {
  department_id?: number;
  from_office?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
}): Promise<LetterOut[]> {
  const all: LetterOut[] = [];
  let offset = 0;
  for (;;) {
    const res = await listLetters({
      limit: API_PAGE_LIMIT,
      offset,
      department_id: params.department_id,
      from_office: params.from_office,
      date_from: params.date_from,
      date_to: params.date_to,
      q: params.q,
    });
    all.push(...res.items);
    if (res.items.length < API_PAGE_LIMIT) break;
    offset += API_PAGE_LIMIT;
  }
  return all;
}

function isReadyForClosure(letter: LetterOut): boolean {
  const latest = letter.latest_assignment ?? null;
  const visible = getVisibleWorkflowStatus(letter, latest, {
    preferPendingFinalClosure: true,
  });
  return Boolean(
    latest &&
      (latest.work_status === "resolved" ||
        (latest.resolution_note ?? "").trim() ||
        latest.has_solution_file ||
        visible.visibleLabel === "Pending Final Closure")
  );
}

export function ClosureLettersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const departmentId = admin ? undefined : workflowDepartmentId(user);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<LetterOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  const STATUS_OPTS = [
    { value: "pending_final_closure", label: "Pending Final Closure" },
    { value: "solution_submitted", label: "Solution Submitted" },
    { value: "under_investigation", label: "Under Investigation" },
    { value: "assigned_to_consultant", label: "Assigned to Consultant" },
  ];

  useEffect(() => {
    if (admin) {
      void fetchDepartments({ excludeLegacy: true }).then(setDepartments);
    }
  }, [admin]);

  useEffect(() => {
    setSearchQ(searchParams.get("q") ?? "");
    setFromOffice(searchParams.get("from_office") ?? "");
    setStatus(searchParams.get("status") ?? "");
    setDateFrom(searchParams.get("date_from") ?? "");
    setDateTo(searchParams.get("date_to") ?? "");
    setDepartmentFilter(searchParams.get("department_id") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pull workflow-relevant letters (each request ≤100 per API), then filter closure-ready.
      const merged = await fetchAllLettersForClosure({
        department_id: departmentId ?? (departmentFilter ? Number(departmentFilter) : undefined),
        from_office: fromOffice || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: searchQ || undefined,
      });
      let ready = merged.filter((l) => l.status !== "closed" && l.status !== "rejected");
      ready = ready.filter(isReadyForClosure);
      if (status) {
        ready = ready.filter((l) => {
          const v = getVisibleWorkflowStatus(l, l.latest_assignment ?? null, {
            preferPendingFinalClosure: true,
          });
          if (status === "pending_final_closure") return v.visibleLabel === "Pending Final Closure";
          if (status === "solution_submitted") return v.visibleLabel === "Solution Submitted";
          if (status === "under_investigation") return v.visibleLabel === "Under Investigation";
          if (status === "assigned_to_consultant") return v.visibleLabel === "Assigned to Consultant";
          return true;
        });
      }
      const start = page * PAGE;
      setTotal(ready.length);
      setItems(ready.slice(start, start + PAGE));
    } catch (e) {
      setError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, departmentId, departmentFilter, fromOffice, dateFrom, dateTo, searchQ, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<LetterOut>[] = [
    {
      id: "serial_no",
      header: "Serial No",
      cell: (l) => (
        <Link href={`/dashboard/letters/${l.id}#closure`} className="text-primary font-medium hover:underline">
          {l.serial_no}
        </Link>
      ),
    },
    {
      id: "memo_no",
      header: "Memo No",
      cell: (l) => <span className="text-sm">{l.memo_no?.trim() ? l.memo_no : "—"}</span>,
    },
    {
      id: "subject",
      header: "Subject",
      cell: (l) => <div className="max-w-[280px] truncate text-sm">{l.subject}</div>,
    },
    {
      id: "from",
      header: "From Office",
      cell: (l) => <span className="max-w-[220px] truncate text-sm">{l.received_from}</span>,
    },
    {
      id: "dept",
      header: "Department",
      cell: (l) => <span className="text-sm">{l.department?.name ?? "—"}</span>,
    },
    {
      id: "consultant",
      header: "Consultant",
      cell: (l) => (
        <span className="text-sm">
          {l.latest_assignment?.consultant_user?.full_name ?? "Unassigned"}
        </span>
      ),
    },
    {
      id: "submitted",
      header: "Solution Submitted Date",
      cell: (l) => {
        const a = l.latest_assignment;
        const dt =
          a?.latest_solution_file_uploaded_at ??
          (a?.work_status === "resolved" ? a.updated_at : null) ??
          null;
        return <span className="text-sm">{dt ? new Date(dt).toLocaleString() : "—"}</span>;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (l) => (
        <VisibleWorkflowStatusBadge
          letter={l}
          latestAssignment={l.latest_assignment ?? null}
          preferPendingFinalClosure
        />
      ),
    },
    {
      id: "review",
      header: "View / Review",
      className: "w-28",
      cell: (l) => (
        <Link
          href={`/dashboard/letters/${l.id}#closure`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          View / Review
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closure"
        description="Final review queue for authorized users. Only closure-ready letters are shown."
      />

      {error ? <ErrorBanner message={error} /> : null}

      <LetterFilterBar
        search={searchQ}
        fromOffice={fromOffice}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        department={departmentFilter}
        onSearchChange={setSearchQ}
        onFromOfficeChange={setFromOffice}
        onStatusChange={setStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onDepartmentChange={setDepartmentFilter}
        onApply={() => {
          setPage(0);
          const next = new URLSearchParams(searchParams.toString());
          next.set("q", searchQ);
          next.set("from_office", fromOffice);
          next.set("status", status);
          next.set("date_from", dateFrom);
          next.set("date_to", dateTo);
          if (departmentFilter) next.set("department_id", departmentFilter);
          else next.delete("department_id");
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
          setDepartmentFilter("");
          setPage(0);
          router.replace(pathname);
        }}
        statusOptions={STATUS_OPTS}
        showDepartment={admin}
        departmentOptions={departments.map((d) => ({ value: String(d.id), label: d.name }))}
      />

      <DataTable
        columns={columns}
        data={items}
        getRowKey={(l) => l.id}
        isLoading={loading}
        emptyContent={
          <EmptyState
            title="No closure-ready letters"
            description="Letters appear here when consultant solution evidence exists and final closure is pending."
          />
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
