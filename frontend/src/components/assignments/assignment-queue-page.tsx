"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AssignConsultantDialog } from "@/components/assignments/assign-consultant-dialog";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { canAssignConsultant, isAdmin } from "@/lib/auth/roles";
import { ASSIGNMENT_QUEUE_STATUS_OPTIONS } from "@/lib/workflow-display";
import { getAssignmentTracking } from "@/lib/api/assignments";
import { fetchDepartments } from "@/lib/api/users";
import { useAssignmentQueueLetters } from "@/hooks/use-assignment-queue-letters";
import type { LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

export function AssignmentQueuePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user);
  /**
   * Do not default-filter by the viewer's department: cross-team TL forwards keep the
   * letter's `department_id` on the source department while the assignee is another TL;
   * a default `department_id` query would hide those rows even though the API already
   * scopes the queue (assignee + department-routed pool). Optional narrowing uses the
   * filter bar only (`departmentFilter` inside the hook).
   */
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
  } = useAssignmentQueueLetters(undefined);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  const [assignLetter, setAssignLetter] = useState<LetterOut | null>(null);
  const [assignMode, setAssignMode] = useState<"assign" | "reassign">("assign");

  const canAssign = canAssignConsultant(user);

  const STATUS_OPTS = [...ASSIGNMENT_QUEUE_STATUS_OPTIONS];

  useEffect(() => {
    if (admin) {
      void fetchDepartments({ excludeLegacy: true }).then(setDepartments);
    }
  }, [admin]);

  useEffect(() => {
    filters.setSearchQ(searchParams.get("q") ?? "");
    filters.setFromOffice(searchParams.get("from_office") ?? "");
    filters.setStatus(searchParams.get("status") ?? "");
    filters.setDateFrom(searchParams.get("date_from") ?? "");
    filters.setDateTo(searchParams.get("date_to") ?? "");
    filters.setDepartmentFilter(searchParams.get("department_id") ?? "");
    setPage(Number(searchParams.get("page") ?? "0") || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openAssign(l: LetterOut) {
    try {
      const t = await getAssignmentTracking(l.id);
      const active = t.assignments.some((a) => a.is_active);
      setAssignMode(active ? "reassign" : "assign");
    } catch {
      setAssignMode("assign");
    }
    setAssignLetter(l);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment"
        description="Letters currently under review in your scope. Assign or reassign a consultant when ready."
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
          filters.setStatus("");
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
        getLetterDetailHref={(l) => `/dashboard/assignment/${l.id}`}
        renderRowAction={
          canAssign
            ? (l) => (
                <Button size="sm" onClick={() => void openAssign(l)}>
                  Assign
                </Button>
              )
            : undefined
        }
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

      {assignLetter ? (
        assignLetter.department ? (
          <AssignConsultantDialog
            letterId={assignLetter.id}
            departmentId={assignLetter.department.id}
            open={Boolean(assignLetter)}
            onOpenChange={(o) => {
              if (!o) setAssignLetter(null);
            }}
            mode={assignMode}
            onSuccess={() => {
              setAssignLetter(null);
              void reload();
            }}
          />
        ) : null
      ) : null}
    </div>
  );
}
