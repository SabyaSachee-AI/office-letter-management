"use client";

import { useState } from "react";

import { AssignConsultantDialog } from "@/components/assignments/assign-consultant-dialog";
import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { canAssignConsultant, isAdmin } from "@/lib/auth/roles";
import { getAssignmentTracking } from "@/lib/api/assignments";
import { useUnderReviewLetters } from "@/hooks/use-under-review-letters";
import type { LetterOut } from "@/types/letter";

export function AssignmentQueuePage() {
  const { user } = useAuth();
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
  } = useUnderReviewLetters(departmentId);

  const [assignLetter, setAssignLetter] = useState<LetterOut | null>(null);
  const [assignMode, setAssignMode] = useState<"assign" | "reassign">("assign");

  const canAssign = canAssignConsultant(user);

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

      <LettersTable
        letters={items}
        loading={loading}
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
        onPageChange={setPage}
      />

      {assignLetter ? (
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
      ) : null}
    </div>
  );
}
