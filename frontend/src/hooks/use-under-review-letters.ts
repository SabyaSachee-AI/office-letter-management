"use client";

import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "@/lib/api/error-message";
import { listLetters } from "@/lib/api/letters";
import type { LetterOut } from "@/types/letter";

const PAGE_SIZE = 20;

/**
 * Shared list loader for Assignment + Closure queues (same API filters).
 */
export function useUnderReviewLetters(departmentId: number | undefined) {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<LetterOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [status, setStatus] = useState("under_review");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLetters({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: status || undefined,
        department_id: departmentId ?? (departmentFilter ? Number(departmentFilter) : undefined),
        from_office: fromOffice || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: searchQ || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, departmentId, departmentFilter, status, fromOffice, dateFrom, dateTo, searchQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    page,
    setPage,
    pageSize: PAGE_SIZE,
    items,
    total,
    loading,
    error,
    reload: load,
    filters: {
      searchQ,
      setSearchQ,
      fromOffice,
      setFromOffice,
      status,
      setStatus,
      dateFrom,
      setDateFrom,
      dateTo,
      setDateTo,
      departmentFilter,
      setDepartmentFilter,
    },
  };
}
