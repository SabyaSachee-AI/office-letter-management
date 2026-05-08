"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsultantAssignmentsTable } from "@/components/consultant/consultant-assignments-table";
import { ErrorBanner } from "@/components/data/error-banner";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { listMyAssignments } from "@/lib/api/consultant";
import { workflowDepartmentId } from "@/lib/auth/roles";
import { ASSIGNMENT_STATUS_FILTER_OPTIONS } from "@/lib/workflow-display";
import type { ConsultantAssignmentRow } from "@/types/letter";

const PAGE = 10;

export function ConsultantWorkPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ConsultantAssignmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQ(searchParams.get("q") ?? "");
    setFromOffice(searchParams.get("from_office") ?? "");
    const statusParam = searchParams.get("status") ?? "";
    setWorkStatus(statusParam);
    setDateFrom(searchParams.get("date_from") ?? "");
    setDateTo(searchParams.get("date_to") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const STATUS_OPTS = [...ASSIGNMENT_STATUS_FILTER_OPTIONS];

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listMyAssignments(PAGE, page * PAGE, {
        q: searchQ || undefined,
        from_office: fromOffice || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        work_status: (workStatus || undefined) as
          | "assigned"
          | "in_progress"
          | "resolved"
          | "transferred"
          | undefined,
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
  }, [page, searchQ, fromOffice, dateFrom, dateTo, workStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const deptForPeers = workflowDepartmentId(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultant workspace"
        description="Your assigned letters are listed below. Open View for the full letter review screen (attachment, summary, and resolution actions)."
      />

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {!deptForPeers ? (
        <p className="text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          Your profile has no primary department set. You can still work assigned letters; set a
          department on your user account if you need department-scoped options.
        </p>
      ) : null}

      <LetterFilterBar
        search={searchQ}
        fromOffice={fromOffice}
        status={workStatus}
        dateFrom={dateFrom}
        dateTo={dateTo}
        department=""
        onSearchChange={setSearchQ}
        onFromOfficeChange={setFromOffice}
        onStatusChange={setWorkStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onDepartmentChange={() => undefined}
        onApply={() => {
          setPage(0);
          const next = new URLSearchParams(searchParams.toString());
          next.set("q", searchQ);
          next.set("from_office", fromOffice);
          next.set("status", workStatus);
          next.set("date_from", dateFrom);
          next.set("date_to", dateTo);
          next.set("page", "0");
          router.replace(`${pathname}?${next.toString()}`);
          void load();
        }}
        onReset={() => {
          setSearchQ("");
          setFromOffice("");
          setWorkStatus("");
          setDateFrom("");
          setDateTo("");
          setPage(0);
          router.replace(pathname);
        }}
        statusOptions={STATUS_OPTS}
        showDepartment={false}
      />

      <ConsultantAssignmentsTable rows={items} loading={loading} />

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
