"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/data/pagination-bar";
import { ConsultantAssignmentWork } from "@/components/consultant/consultant-assignment-work";
import { EmptyState } from "@/components/data/empty-state";
import { useAuth } from "@/context/auth-context";
import { listMyAssignments } from "@/lib/api/consultant";
import type { ConsultantAssignmentRow } from "@/types/letter";

const PAGE = 10;

export function ConsultantWorkPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ConsultantAssignmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyAssignments(PAGE, page * PAGE);
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.department?.id) {
    return (
      <EmptyState
        title="No department"
        description="Your account needs a department to use consultant tools (e.g. transfer within department)."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultant workspace"
        description="Update status, document resolution, upload solution files, or transfer work to a colleague."
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No active assignments"
          description="When a team leader assigns you a letter, it will appear here."
        />
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <ConsultantAssignmentWork
              key={row.assignment.id}
              row={row}
              departmentId={user.department!.id}
              onUpdated={() => void load()}
            />
          ))}
        </div>
      )}

      <PaginationBar page={page} pageSize={PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}
