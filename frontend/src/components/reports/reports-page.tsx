"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { LetterFilterBar } from "@/components/letters/letter-filter-bar";
import { LettersTable } from "@/components/letters/letters-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { isAdmin, isCentralLetterRole } from "@/lib/auth/roles";
import {
  downloadLettersPdf,
  downloadLettersXlsx,
  fetchReportAnalytics,
} from "@/lib/api/reports";
import { listLetters } from "@/lib/api/letters";
import { fetchDepartments } from "@/lib/api/users";
import type { AnalyticsOut } from "@/types/reports";
import type { LetterOut } from "@/types/letter";
import type { DepartmentOut } from "@/types/user";

const STATUS_OPTS = [
  { value: "pending_assignment", label: "Pending Assignment" },
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under review" },
  { value: "returned_for_correction", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "processed", label: "Processed" },
  { value: "closed", label: "Closed" },
];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ");
}

function DistributionBars({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) {
    return (
      <div className="text-muted-foreground text-sm">No data for this filter.</div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-2">
        {entries.map(([k, v]) => (
          <li key={k} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="capitalize">{humanizeKey(k)}</span>
              <span className="text-muted-foreground">{v}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const central = isCentralLetterRole(user);
  const defaults = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [status, setStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [fromOffice, setFromOffice] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOut | null>(null);
  const [sampleLetters, setSampleLetters] = useState<LetterOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDateFrom(searchParams.get("date_from") ?? defaults.from);
    setDateTo(searchParams.get("date_to") ?? defaults.to);
    setStatus(searchParams.get("status") ?? "");
    setSearchQ(searchParams.get("q") ?? "");
    setFromOffice(searchParams.get("from_office") ?? "");
    setDeptFilter(searchParams.get("department_id") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchDepartments({ excludeLegacy: true }).then(setDepartments);
  }, []);

  const departmentId = admin
    ? deptFilter
      ? Number(deptFilter)
      : undefined
    : central
      ? deptFilter
        ? Number(deptFilter)
        : undefined
      : user?.department?.id;

  const queryParams = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      status: status || undefined,
      department_id: departmentId,
      q: searchQ || undefined,
      from_office: fromOffice || undefined,
    }),
    [dateFrom, dateTo, status, departmentId, searchQ, fromOffice]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, lettersRes] = await Promise.all([
        fetchReportAnalytics(queryParams),
        listLetters({
          limit: 25,
          offset: 0,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          department_id: departmentId,
          q: searchQ || undefined,
          from_office: fromOffice || undefined,
          status:
            status === "pending_assignment"
              ? "received"
              : status || undefined,
          unassigned_only: status === "pending_assignment",
        }),
      ]);
      setAnalytics(data);
      setSampleLetters(lettersRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setSampleLetters([]);
    } finally {
      setLoading(false);
    }
  }, [
    queryParams,
    dateFrom,
    dateTo,
    departmentId,
    searchQ,
    fromOffice,
    status,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & exports"
        description="Analytics for letters and assignments. Exports use the same filters. Non-administrators are scoped to their department."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm">
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
            const next = new URLSearchParams(searchParams.toString());
            next.set("q", searchQ);
            next.set("from_office", fromOffice);
            next.set("status", status);
            next.set("date_from", dateFrom);
            next.set("date_to", dateTo);
            if (deptFilter) next.set("department_id", deptFilter);
            else next.delete("department_id");
            router.replace(`${pathname}?${next.toString()}`);
            void load();
          }}
          onReset={() => {
            setSearchQ("");
            setFromOffice("");
            setStatus("");
            setDeptFilter("");
            setDateFrom(defaults.from);
            setDateTo(defaults.to);
            router.replace(pathname);
          }}
          statusOptions={STATUS_OPTS}
          showDepartment={admin || central}
          departmentOptions={departments.map((d) => ({
            value: String(d.id),
            label: d.name,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm">
        <div className="grid gap-1.5">
          <Label htmlFor="rep-from" className="text-muted-foreground text-xs">
            From
          </Label>
          <Input
            id="rep-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-to" className="text-muted-foreground text-xs">
            To
          </Label>
          <Input
            id="rep-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!exporting}
          onClick={async () => {
            setExporting("pdf");
            try {
              await downloadLettersPdf(queryParams);
            } finally {
              setExporting(null);
            }
          }}
        >
          {exporting === "pdf" ? "Preparing…" : "Download PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!exporting}
          onClick={async () => {
            setExporting("xlsx");
            try {
              await downloadLettersXlsx(queryParams);
            } finally {
              setExporting(null);
            }
          }}
        >
          {exporting === "xlsx" ? "Preparing…" : "Download Excel"}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : analytics ? (
        <>
          <div className="text-muted-foreground text-xs">
            Period:{" "}
            {analytics.period.date_from && analytics.period.date_to
              ? `${analytics.period.date_from} → ${analytics.period.date_to}`
              : analytics.period.date_from
                ? `From ${analytics.period.date_from}`
                : analytics.period.date_to
                  ? `Until ${analytics.period.date_to}`
                  : "All time (no date filter)"}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Letters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {analytics.total_letters}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Closed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {analytics.closed_letters}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Active assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {analytics.active_assignments}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Avg. days to close
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {analytics.avg_days_to_close != null
                    ? analytics.avg_days_to_close
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letters matching filters</CardTitle>
              <p className="text-muted-foreground text-sm">
                Sample of up to 25 letters for the current filters (same scope as exports). Open a
                row to review the full letter and workflow history.
              </p>
            </CardHeader>
            <CardContent>
              <LettersTable letters={sampleLetters} loading={loading} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Letter breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <DistributionBars
                  title="By status"
                  data={analytics.letters_by_status}
                />
                <DistributionBars
                  title="By priority"
                  data={analytics.letters_by_priority}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DistributionBars
                  title="Assignments by work status"
                  data={analytics.assignments_by_work_status}
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Audit events</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {analytics.audit_events}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Logins (ok / fail)</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {analytics.logins_success} / {analytics.logins_failed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
