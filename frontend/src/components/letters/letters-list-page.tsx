"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { expandAllowedScreensKeys } from "@/config/navigation";
import { isAdmin, isCentralLetterRole } from "@/lib/auth/roles";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { fetchDepartments } from "@/lib/api/users";
import { listLetters } from "@/lib/api/letters";
import type { LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

const PAGE = 20;

const STATUS_OPTS = [
  { value: "pending_assignment", label: "Pending Assignment" },
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under review" },
  { value: "returned_for_correction", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "processed", label: "Processed" },
  { value: "closed", label: "Closed" },
];

export function LettersListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const central = isCentralLetterRole(user);
  const canReceiveLetter = expandAllowedScreensKeys(user?.allowed_screens ?? []).has(
    "letters:create"
  );
  const [status, setStatus] = useState("");
  const isPendingOnly = status === "pending_assignment";
  const statusValue = isPendingOnly ? undefined : status || undefined;
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<LetterOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQ(searchParams.get("q") ?? "");
    setFromOffice(searchParams.get("from_office") ?? "");
    setStatus(searchParams.get("status") ?? "");
    setDateFrom(searchParams.get("date_from") ?? "");
    setDateTo(searchParams.get("date_to") ?? "");
    setDeptFilter(searchParams.get("department_id") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departmentId = admin
    ? deptFilter
      ? Number(deptFilter)
      : undefined
    : central
      ? deptFilter
        ? Number(deptFilter)
        : undefined
      : user?.department?.id ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [deptRows, res] = await Promise.all([
        admin || central
          ? fetchDepartments({ excludeLegacy: true })
          : Promise.resolve([] as DepartmentOut[]),
        listLetters({
          limit: PAGE,
          offset: page * PAGE,
          status: statusValue,
          department_id: departmentId,
          unassigned_only: isPendingOnly,
          from_office: fromOffice || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          q: searchQ.trim() || undefined,
        }),
      ]);
      if (admin || central) setDepartments(deptRows);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setListError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    statusValue,
    isPendingOnly,
    fromOffice,
    dateFrom,
    dateTo,
    departmentId,
    admin,
    central,
    searchQ,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letters"
        description="Browse registered letters. Receiving and Approval roles see all incoming letters; Team Leaders are scoped to their department."
        actions={
          canReceiveLetter ? (
            <Link
              href="/dashboard/letters/receive"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Receive letter
            </Link>
          ) : null
        }
      />

      {listError ? <ErrorBanner message={listError} /> : null}

      <LetterFilterBar
        search={searchQ}
        fromOffice={fromOffice}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        department={deptFilter}
        onSearchChange={setSearchQ}
        onFromOfficeChange={setFromOffice}
        onStatusChange={setStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onDepartmentChange={setDeptFilter}
        onApply={() => {
          setPage(0);
          const next = new URLSearchParams(searchParams.toString());
          next.set("q", searchQ);
          next.set("from_office", fromOffice);
          next.set("status", status);
          next.set("date_from", dateFrom);
          next.set("date_to", dateTo);
          if (deptFilter) next.set("department_id", deptFilter);
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
          setDeptFilter("");
          setPage(0);
          router.replace(pathname);
        }}
        statusOptions={STATUS_OPTS}
        showDepartment={admin || central}
        departmentOptions={departments.map((d) => ({ value: String(d.id), label: d.name }))}
      />

      <LettersTable letters={items} loading={loading} />

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
