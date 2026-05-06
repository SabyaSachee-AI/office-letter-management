"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { fetchDepartments } from "@/lib/api/users";
import { useUnderReviewLetters } from "@/hooks/use-under-review-letters";
import type { DepartmentOut } from "@/types/user";

export function ClosureLettersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const departmentId = isAdmin(user)
    ? undefined
    : user?.department?.id ?? undefined;

  const {
    page,
    setPage,
    pageSize,
    items,
    total,
    loading,
    error,
    reload,
    filters,
  } = useUnderReviewLetters(departmentId);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  const STATUS_OPTS = [
    { value: "under_review", label: "Under review" },
    { value: "processed", label: "Processed" },
    { value: "closed", label: "Closed" },
  ];

  useEffect(() => {
    if (admin) {
      void fetchDepartments({ excludeLegacy: true }).then(setDepartments);
    }
  }, [admin]);

  useEffect(() => {
    filters.setSearchQ(searchParams.get("q") ?? "");
    filters.setFromOffice(searchParams.get("from_office") ?? "");
    filters.setStatus(searchParams.get("status") ?? "under_review");
    filters.setDateFrom(searchParams.get("date_from") ?? "");
    filters.setDateTo(searchParams.get("date_to") ?? "");
    filters.setDepartmentFilter(searchParams.get("department_id") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closure"
        description="Letters under review that may be ready for solution review and formal closure. Open a letter and scroll to the closure panel."
      />

      {error ? <ErrorBanner message={error} /> : null}

      <LetterFilterBar
        search={filters.searchQ}
        fromOffice={filters.fromOffice}
        status={filters.status}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        department={filters.departmentFilter}
        onSearchChange={filters.setSearchQ}
        onFromOfficeChange={filters.setFromOffice}
        onStatusChange={filters.setStatus}
        onDateFromChange={filters.setDateFrom}
        onDateToChange={filters.setDateTo}
        onDepartmentChange={filters.setDepartmentFilter}
        onApply={() => {
          setPage(0);
          const next = new URLSearchParams(searchParams.toString());
          next.set("q", filters.searchQ);
          next.set("from_office", filters.fromOffice);
          next.set("status", filters.status);
          next.set("date_from", filters.dateFrom);
          next.set("date_to", filters.dateTo);
          if (filters.departmentFilter) next.set("department_id", filters.departmentFilter);
          else next.delete("department_id");
          next.set("page", "0");
          router.replace(`${pathname}?${next.toString()}`);
          void reload();
        }}
        onReset={() => {
          filters.setSearchQ("");
          filters.setFromOffice("");
          filters.setStatus("under_review");
          filters.setDateFrom("");
          filters.setDateTo("");
          filters.setDepartmentFilter("");
          setPage(0);
          router.replace(pathname);
        }}
        statusOptions={STATUS_OPTS}
        showDepartment={admin}
        departmentOptions={departments.map((d) => ({ value: String(d.id), label: d.name }))}
      />

      <LettersTable
        letters={items}
        loading={loading}
        renderRowAction={(l) => (
          <Link
            href={`/dashboard/letters/${l.id}#closure`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Closure
          </Link>
        )}
      />

      <PaginationBar
        page={page}
        pageSize={pageSize}
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
