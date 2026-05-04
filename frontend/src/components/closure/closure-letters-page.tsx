"use client";

import Link from "next/link";

import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { useUnderReviewLetters } from "@/hooks/use-under-review-letters";

export function ClosureLettersPage() {
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
  } = useUnderReviewLetters(departmentId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closure"
        description="Letters under review that may be ready for solution review and formal closure. Open a letter and scroll to the closure panel."
      />

      {error ? <ErrorBanner message={error} /> : null}

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
        onPageChange={setPage}
      />
    </div>
  );
}
