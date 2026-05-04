"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { FilterSelect } from "@/components/forms/filter-select";
import { LettersTable } from "@/components/letters/letters-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { fetchDepartments } from "@/lib/api/users";
import { listLetters } from "@/lib/api/letters";
import type { LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

const PAGE = 20;

const STATUS_OPTS = [
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under review" },
  { value: "returned_for_correction", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "processed", label: "Processed" },
  { value: "closed", label: "Closed" },
];

export function LettersListPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [status, setStatus] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<LetterOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const departmentId = admin
    ? deptFilter
      ? Number(deptFilter)
      : undefined
    : user?.department?.id ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [deptRows, res] = await Promise.all([
        admin ? fetchDepartments() : Promise.resolve([] as DepartmentOut[]),
        listLetters({
          limit: PAGE,
          offset: page * PAGE,
          status: status || undefined,
          department_id: departmentId,
        }),
      ]);
      if (admin) setDepartments(deptRows);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setListError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, departmentId, admin]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letters"
        description="Browse registered letters. Filters respect your department unless you are an administrator."
        actions={
          <Link
            href="/dashboard/letters/receive"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Receive letter
          </Link>
        }
      />

      {listError ? <ErrorBanner message={listError} /> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200/80 bg-slate-50/90 p-3 shadow-sm sm:p-4">
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Status</span>
          <FilterSelect
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            options={STATUS_OPTS}
            placeholderLabel="Any status"
          />
        </div>
        {admin ? (
          <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              Department
            </span>
            <FilterSelect
              aria-label="Department"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(0);
              }}
              options={departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              placeholderLabel="All departments"
            />
          </div>
        ) : null}
      </div>

      <LettersTable letters={items} loading={loading} />

      <PaginationBar
        page={page}
        pageSize={PAGE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}
