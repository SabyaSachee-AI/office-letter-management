"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { ErrorBanner } from "@/components/data/error-banner";
import { PaginationBar } from "@/components/data/pagination-bar";
import { FilterSelect, type FilterSelectOption } from "@/components/forms/filter-select";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  downloadAuditLogsCsv,
  getAuditLogFilterOptions,
  listAuditLogs,
} from "@/lib/api/activity";
import { formatAuditLogDescription } from "@/lib/audit/format-audit-description";
import type { AuditLogOut } from "@/types/activity";

const PAGE_SIZE = 20;

type SecurityFilters = {
  user: string;
  module: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: SecurityFilters = {
  user: "",
  module: "",
  action: "",
  dateFrom: "",
  dateTo: "",
};

function toFriendlyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function SecurityLogsPage() {
  const [draftFilters, setDraftFilters] = useState<SecurityFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<SecurityFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditLogOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleOptions, setModuleOptions] = useState<FilterSelectOption[]>([]);
  const [actionOptions, setActionOptions] = useState<FilterSelectOption[]>([]);
  const [downloading, setDownloading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        user: appliedFilters.user.trim() || undefined,
        module: appliedFilters.module || undefined,
        action: appliedFilters.action || undefined,
        date_from: appliedFilters.dateFrom
          ? new Date(`${appliedFilters.dateFrom}T00:00:00.000Z`).toISOString()
          : undefined,
        date_to: appliedFilters.dateTo
          ? new Date(`${appliedFilters.dateTo}T23:59:59.999Z`).toISOString()
          : undefined,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    let mounted = true;
    void getAuditLogFilterOptions()
      .then((data) => {
        if (!mounted) return;
        setModuleOptions(
          data.modules.map((m) => ({ value: m, label: toFriendlyLabel(m) }))
        );
        setActionOptions(
          data.actions.map((a) => ({ value: a, label: toFriendlyLabel(a) }))
        );
      })
      .catch(() => {
        if (!mounted) return;
        setModuleOptions([]);
        setActionOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo<DataTableColumn<AuditLogOut>[]>(
    () => [
      {
        id: "created_at",
        header: "Date/Time",
        cell: (r) => new Date(r.created_at).toLocaleString(),
      },
      {
        id: "user",
        header: "User",
        cell: (r) => r.user_name || r.actor_email || "System",
      },
      {
        id: "role",
        header: "Role",
        cell: (r) => r.role || "—",
      },
      {
        id: "module",
        header: "Module",
        cell: (r) => {
          const raw = r.module || r.resource_type;
          return raw ? toFriendlyLabel(raw) : "—";
        },
      },
      {
        id: "action",
        header: "Action",
        cell: (r) => toFriendlyLabel(r.action),
      },
      {
        id: "description",
        header: "Description",
        className: "max-w-md whitespace-normal text-slate-700",
        cell: (r) => (
          <span title={r.detail_json || r.new_value || undefined}>
            {formatAuditLogDescription(r)}
          </span>
        ),
      },
    ],
    []
  );

  async function handleDownloadCsv() {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadAuditLogsCsv({
        user: appliedFilters.user.trim() || undefined,
        module: appliedFilters.module || undefined,
        action: appliedFilters.action || undefined,
        date_from: appliedFilters.dateFrom
          ? new Date(`${appliedFilters.dateFrom}T00:00:00.000Z`).toISOString()
          : undefined,
        date_to: appliedFilters.dateTo
          ? new Date(`${appliedFilters.dateTo}T23:59:59.999Z`).toISOString()
          : undefined,
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${stamp}-utc.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security logs"
        description="Track key system actions for audit and accountability."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            title="Exports up to 10,000 rows using the filters you applied (click Apply after changing filters)."
            onClick={() => void handleDownloadCsv()}
          >
            {downloading ? "Downloading…" : "Download logs (CSV)"}
          </Button>
        }
      />

      <section className="grid gap-3 rounded-lg border border-slate-200/80 p-4 md:grid-cols-5">
        <Input
          value={draftFilters.user}
          onChange={(e) =>
            setDraftFilters((prev) => ({ ...prev, user: e.target.value }))
          }
          placeholder="User name or role"
          aria-label="User filter"
        />
        <FilterSelect
          value={draftFilters.module}
          onChange={(e) =>
            setDraftFilters((prev) => ({ ...prev, module: e.target.value }))
          }
          options={moduleOptions}
          placeholderLabel="All modules"
          aria-label="Module filter"
        />
        <FilterSelect
          value={draftFilters.action}
          onChange={(e) =>
            setDraftFilters((prev) => ({ ...prev, action: e.target.value }))
          }
          options={actionOptions}
          placeholderLabel="All actions"
          aria-label="Action filter"
        />
        <Input
          value={draftFilters.dateFrom}
          onChange={(e) =>
            setDraftFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
          }
          type="date"
          aria-label="Date from"
        />
        <Input
          value={draftFilters.dateTo}
          onChange={(e) =>
            setDraftFilters((prev) => ({ ...prev, dateTo: e.target.value }))
          }
          type="date"
          aria-label="Date to"
        />
        <div className="md:col-span-5 flex gap-2">
          <Button
            type="button"
            onClick={() => {
              setAppliedFilters({ ...draftFilters });
              setPage(0);
            }}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraftFilters(emptyFilters);
              setAppliedFilters(emptyFilters);
              setPage(0);
            }}
          >
            Reset
          </Button>
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        isLoading={loading}
        emptyContent={<p className="text-muted-foreground text-sm">No logs found.</p>}
      />

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}
