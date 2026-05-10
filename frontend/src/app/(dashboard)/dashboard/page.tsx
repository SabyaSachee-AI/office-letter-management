"use client";

import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileWarning,
  Files,
  Filter,
  RotateCcw,
  Undo2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { ErrorBanner } from "@/components/data/error-banner";
import { PaginationBar } from "@/components/data/pagination-bar";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardAnalyticsPrintSummary } from "@/components/dashboard/dashboard-analytics-print-summary";
import { NoticeBoard } from "@/components/dashboard/notice-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import {
  downloadAnalyticsCsv,
  fetchAnalyticsConsultants,
  fetchAnalyticsDepartments,
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
} from "@/lib/api/analytics";
import { getApiErrorMessage } from "@/lib/api/error-message";
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  ConsultantAnalyticsOut,
  DepartmentAnalyticsOut,
  TrendsOut,
  WorkflowStatusItem,
} from "@/types/analytics";

const presets = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const ANALYTICS_TABLE_PAGE_SIZE = 10;
/** API max; print summary fetches up to this many rows per table for the current filters. */
const ANALYTICS_PRINT_FETCH_LIMIT = 200;

function formatAnalyticsFilterSummary(filters: AnalyticsFilters): string {
  const presetVal = filters.preset || "30d";
  const presetLabel = presets.find((p) => p.value === presetVal)?.label ?? presetVal;
  if (filters.date_from || filters.date_to) {
    return `From ${filters.date_from || "…"} to ${filters.date_to || "…"}`;
  }
  return presetLabel;
}

function analyticsExportFilename(filters: AnalyticsFilters): string {
  const slug = (s: string) => s.replace(/[/\\:*?"<>|]/g, "-");
  const preset = slug(filters.preset || "30d");
  if (filters.date_from || filters.date_to) {
    return `dashboard-analytics_${preset}_${slug(filters.date_from || "start")}_${slug(filters.date_to || "end")}.csv`;
  }
  return `dashboard-analytics_${preset}.csv`;
}

type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  column,
  activeColumn,
  dir,
  onSort,
}: {
  label: string;
  column: string;
  activeColumn: string;
  dir: SortDir;
  onSort: (column: string) => void;
}) {
  const active = activeColumn === column;
  return (
    <TableHead className="whitespace-nowrap">
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#123f63]"
        onClick={() => onSort(column)}
      >
        {label}
        {active ? <span className="tabular-nums text-xs">{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </TableHead>
  );
}

function MiniBars({ items }: { items: WorkflowStatusItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="grid gap-2">
      {items.map((i) => (
        <div key={i.key} className="grid grid-cols-[180px_1fr_50px] items-center gap-2 text-xs">
          <span className="text-slate-600">{i.label}</span>
          <div className="h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-[#123f63]"
              style={{ width: `${Math.max(6, Math.round((i.count / max) * 100))}%` }}
            />
          </div>
          <span className="text-right font-semibold tabular-nums">{i.count}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ items }: { items: WorkflowStatusItem[] }) {
  const total = items.reduce((n, i) => n + i.count, 0);
  const normalized = total === 0 ? items.map((x) => ({ ...x, count: 1 })) : items;
  const colors = ["#123f63", "#1f6aa5", "#3f8fc7", "#5aa9d8", "#89c2eb", "#2f855a", "#d69e2e", "#dd6b20", "#c53030"];
  let start = 0;
  const slices = normalized.map((i, idx) => {
    const val = i.count;
    const frac = val / normalized.reduce((n, x) => n + x.count, 0);
    const end = start + frac * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const r = 46;
    const cx = 56;
    const cy = 56;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    start = end;
    return <path key={i.key} d={d} fill={colors[idx % colors.length]} />;
  });
  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112">
        {slices}
        <circle cx="56" cy="56" r="24" fill="white" />
        <text x="56" y="58" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
          {total}
        </text>
      </svg>
      <div className="space-y-1 text-xs">
        {items.map((i, idx) => (
          <div key={i.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
            <span className="text-slate-700">{i.label}</span>
            <span className="ml-auto tabular-nums font-semibold">{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>({ preset: "30d" });
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [departments, setDepartments] = useState<DepartmentAnalyticsOut | null>(null);
  const [consultants, setConsultants] = useState<ConsultantAnalyticsOut | null>(null);
  const [trends, setTrends] = useState<TrendsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depPage, setDepPage] = useState(0);
  const [depSort, setDepSort] = useState<{ by: string; dir: SortDir }>({ by: "total_letters", dir: "desc" });
  const [conPage, setConPage] = useState(0);
  const [conSort, setConSort] = useState<{ by: string; dir: SortDir }>({ by: "assigned_count", dir: "desc" });
  const [printSnapshot, setPrintSnapshot] = useState<{
    departments: DepartmentAnalyticsOut;
    consultants: ConsultantAnalyticsOut;
  } | null>(null);
  const [printPreparing, setPrintPreparing] = useState(false);

  const scope = overview?.scope.role_view ?? "";
  const showDepartments = scope !== "consultant";
  const showConsultants = scope !== "receiving_officer";
  const showOrgBottlenecks = scope !== "consultant";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const depPaging = {
      limit: ANALYTICS_TABLE_PAGE_SIZE,
      offset: depPage * ANALYTICS_TABLE_PAGE_SIZE,
      sort_by: depSort.by,
      sort_dir: depSort.dir,
    };
    const conPaging = {
      limit: ANALYTICS_TABLE_PAGE_SIZE,
      offset: conPage * ANALYTICS_TABLE_PAGE_SIZE,
      sort_by: conSort.by,
      sort_dir: conSort.dir,
    };
    const settled = await Promise.allSettled([
      fetchAnalyticsOverview(filters),
      fetchAnalyticsDepartments(filters, depPaging),
      fetchAnalyticsConsultants(filters, conPaging),
      fetchAnalyticsTrends(filters),
    ]);
    const labels = ["Overview", "Departments", "Consultants", "Trends"] as const;
    const failures: string[] = [];
    if (settled[0].status === "fulfilled") {
      setOverview(settled[0].value);
    } else {
      setOverview(null);
      failures.push(`${labels[0]}: ${getApiErrorMessage(settled[0].reason)}`);
    }
    if (settled[1].status === "fulfilled") {
      setDepartments(settled[1].value);
    } else {
      setDepartments(null);
      failures.push(`${labels[1]}: ${getApiErrorMessage(settled[1].reason)}`);
    }
    if (settled[2].status === "fulfilled") {
      setConsultants(settled[2].value);
    } else {
      setConsultants(null);
      failures.push(`${labels[2]}: ${getApiErrorMessage(settled[2].reason)}`);
    }
    if (settled[3].status === "fulfilled") {
      setTrends(settled[3].value);
    } else {
      setTrends(null);
      failures.push(`${labels[3]}: ${getApiErrorMessage(settled[3].reason)}`);
    }
    setError(failures.length ? failures.join(" ") : null);
    setLoading(false);
  }, [filters, depPage, depSort, conPage, conSort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrintSnapshot(null);
  }, [filters, depSort, conSort]);

  const depForPrint = printSnapshot?.departments ?? departments;
  const conForPrint = printSnapshot?.consultants ?? consultants;
  const departmentsTruncated = !!(depForPrint && depForPrint.total > depForPrint.items.length);
  const consultantsTruncated = !!(conForPrint && conForPrint.total > conForPrint.items.length);

  const handlePrintSummary = useCallback(async () => {
    if (!overview) return;
    setPrintPreparing(true);
    setError(null);
    try {
      const depPromise = showDepartments
        ? fetchAnalyticsDepartments(filters, {
            limit: ANALYTICS_PRINT_FETCH_LIMIT,
            offset: 0,
            sort_by: depSort.by,
            sort_dir: depSort.dir,
          })
        : Promise.resolve(null);
      const conPromise = showConsultants
        ? fetchAnalyticsConsultants(filters, {
            limit: ANALYTICS_PRINT_FETCH_LIMIT,
            offset: 0,
            sort_by: conSort.by,
            sort_dir: conSort.dir,
          })
        : Promise.resolve(null);
      const [dep, con] = await Promise.all([depPromise, conPromise]);
      const emptyDep: DepartmentAnalyticsOut = { items: [], total: 0, limit: null, offset: null };
      const emptyCon: ConsultantAnalyticsOut = {
        items: [],
        total: 0,
        limit: null,
        offset: null,
        top_performers: [],
        overloaded_consultants: [],
      };
      flushSync(() => {
        setPrintSnapshot({
          departments: showDepartments ? (dep ?? emptyDep) : emptyDep,
          consultants: showConsultants ? (con ?? emptyCon) : emptyCon,
        });
      });
      window.print();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setPrintPreparing(false);
    }
  }, [overview, filters, depSort, conSort, showDepartments, showConsultants]);

  function toggleDepSort(column: string) {
    setDepSort((prev) =>
      prev.by === column ? { by: column, dir: prev.dir === "asc" ? "desc" : "asc" } : { by: column, dir: "desc" }
    );
    setDepPage(0);
  }

  function toggleConSort(column: string) {
    setConSort((prev) =>
      prev.by === column ? { by: column, dir: prev.dir === "asc" ? "desc" : "asc" } : { by: column, dir: "desc" }
    );
    setConPage(0);
  }

  const cards = useMemo(() => {
    if (!overview) return [];
    const s = overview.summary;
    return [
      { key: "total", title: "Total Letters", value: s.total_letters, icon: Files, subtitle: "All letters in selected period" },
      { key: "pending", title: "Pending Approval", value: s.pending_approval, icon: Clock3, subtitle: "Received & awaiting approval" },
      { key: "processing", title: "Under Department Processing", value: s.under_department_processing, icon: BarChart3, subtitle: "Forwarded / under review" },
      { key: "active", title: "Consultant Active Tasks", value: s.consultant_active_tasks, icon: Briefcase, subtitle: "Assigned or in-progress tasks" },
      { key: "wait_close", title: "Waiting Final Closure", value: s.waiting_final_closure, icon: FileWarning, subtitle: "Resolved but not closed" },
      { key: "closed", title: "Officially Closed", value: s.officially_closed, icon: CheckCircle2, subtitle: "Closed after review" },
      { key: "rejected", title: "Rejected Letters", value: s.rejected_letters, icon: XCircle, subtitle: "Rejected by approval flow" },
      { key: "returned", title: "Returned for Correction", value: s.returned_for_correction, icon: Undo2, subtitle: "Returned back for correction" },
    ];
  }, [overview]);

  async function exportCsv() {
    try {
      const blob = await downloadAnalyticsCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = analyticsExportFilename(filters);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  return (
    <div className="olm-dashboard-page space-y-6">
      <NoticeBoard user={user ?? null} className="print:hidden" />

      <div className="space-y-6 print:hidden">
        <PageHeader
          title="Overview & Analytics"
          description={`Welcome back, ${user?.full_name ?? "officer"}. Management-level operational visibility for workflow, processing, and closure performance.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => void exportCsv()}>
                Export CSV
              </Button>
              <Button type="button" variant="outline" disabled title="Excel export structure reserved for next iteration">
                Export Excel (soon)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || !overview || printPreparing}
                title="A4-sized summary for the current filters. Click this before printing; set the print dialog to A4 portrait and 100% scale. Notice board is not included."
                onClick={() => void handlePrintSummary()}
              >
                {printPreparing ? "Preparing print…" : "Print summary"}
              </Button>
            </div>
          }
        />

        <div className="rounded-xl border bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600">Preset</label>
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={filters.preset || "30d"}
              title="Analytics time preset"
              aria-label="Analytics time preset"
              onChange={(e) => {
                setDepPage(0);
                setConPage(0);
                setFilters((p) => ({ ...p, preset: e.target.value, date_from: undefined, date_to: undefined }));
              }}
            >
              {presets.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600">From</label>
            <Input
              type="date"
              value={filters.date_from || ""}
              onChange={(e) => {
                setDepPage(0);
                setConPage(0);
                setFilters((p) => ({ ...p, date_from: e.target.value || undefined }));
              }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600">To</label>
            <Input
              type="date"
              value={filters.date_to || ""}
              onChange={(e) => {
                setDepPage(0);
                setConPage(0);
                setFilters((p) => ({ ...p, date_to: e.target.value || undefined }));
              }}
            />
          </div>
          <Button type="button" onClick={() => void load()}>
            <Filter className="size-4" /> Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDepPage(0);
              setConPage(0);
              setFilters({ preset: "30d" });
            }}
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
        </div>

        {error ? <ErrorBanner message={error} /> : null}
        {loading ? <p className="text-sm text-slate-500 print:hidden">Loading analytics…</p> : null}

      {overview ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <article key={c.key} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{c.title}</p>
                  <c.icon className="size-4 text-[#123f63]" />
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[#123f63]">{c.value}</p>
                <p className="mt-1 text-xs text-slate-500">{c.subtitle}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Workflow Status Distribution</h3>
              <Donut items={overview.workflow_status.items} />
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Workflow Breakdown (Bar)</h3>
              <MiniBars items={overview.workflow_status.items} />
            </div>
          </section>

          {showDepartments && departments ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Department Analytics</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      label="Department"
                      column="department_name"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                    <SortableHeader
                      label="Total"
                      column="total_letters"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                    <SortableHeader
                      label="Pending"
                      column="pending_count"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                    <SortableHeader
                      label="Closed"
                      column="closed_count"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                    <SortableHeader
                      label="Avg resolution (days)"
                      column="avg_resolution_days"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                    <SortableHeader
                      label="Overdue"
                      column="overdue_assignments"
                      activeColumn={depSort.by}
                      dir={depSort.dir}
                      onSort={toggleDepSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.items.map((d) => (
                    <TableRow key={d.department_id}>
                      <TableCell>{d.department_name} ({d.department_code})</TableCell>
                      <TableCell>{d.total_letters}</TableCell>
                      <TableCell>{d.pending_count}</TableCell>
                      <TableCell>{d.closed_count}</TableCell>
                      <TableCell>{d.avg_resolution_days ?? "—"}</TableCell>
                      <TableCell>
                        <span className={d.overdue_assignments > 0 ? "text-amber-700 font-semibold" : ""}>
                          {d.overdue_assignments}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                className="mt-4"
                page={depPage}
                pageSize={ANALYTICS_TABLE_PAGE_SIZE}
                total={departments.total}
                onPageChange={setDepPage}
              />
            </section>
          ) : null}

          {showConsultants && consultants ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Consultant Performance</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      label="Consultant"
                      column="consultant_name"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Assigned"
                      column="assigned_count"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Resolved"
                      column="resolved_count"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Transferred"
                      column="transferred_count"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Active"
                      column="active_workload"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Overdue"
                      column="overdue_tasks"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                    <SortableHeader
                      label="Avg completion (days)"
                      column="avg_completion_days"
                      activeColumn={conSort.by}
                      dir={conSort.dir}
                      onSort={toggleConSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultants.items.map((c) => (
                    <TableRow key={c.consultant_id}>
                      <TableCell>{c.consultant_name}</TableCell>
                      <TableCell>{c.assigned_count}</TableCell>
                      <TableCell>{c.resolved_count}</TableCell>
                      <TableCell>{c.transferred_count}</TableCell>
                      <TableCell>{c.active_workload}</TableCell>
                      <TableCell>
                        <span className={c.overdue_tasks > 0 ? "text-amber-700 font-semibold" : ""}>
                          {c.overdue_tasks}
                        </span>
                      </TableCell>
                      <TableCell>{c.avg_completion_days ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                className="mt-4"
                page={conPage}
                pageSize={ANALYTICS_TABLE_PAGE_SIZE}
                total={consultants.total}
                onPageChange={setConPage}
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <h4 className="text-sm font-semibold text-green-800">Top Performers</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    {consultants.top_performers.map((p) => (
                      <li key={`top-${p.consultant_id}`} className="flex justify-between">
                        <span>{p.consultant_name}</span>
                        <span className="font-semibold">{p.resolved_count} resolved</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h4 className="text-sm font-semibold text-amber-900">Overloaded Consultants</h4>
                  <p className="mt-1 text-xs leading-snug text-amber-950/80">
                    Consultants with <strong>5 or more active</strong> tasks (assigned or in progress) or{" "}
                    <strong>any overdue</strong> assignment in the selected period. Listed by highest active workload,
                    then overdue count (up to five).
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {consultants.overloaded_consultants.map((p) => (
                      <li key={`over-${p.consultant_id}`} className="flex justify-between">
                        <span>{p.consultant_name}</span>
                        <span className="font-semibold">{p.active_workload} active</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {trends ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Monthly / Time Trends</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trends.letters.map((t) => (
                    <TableRow key={t.period}>
                      <TableCell>{t.period}</TableCell>
                      <TableCell>{t.received}</TableCell>
                      <TableCell>{t.closed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ) : null}

          {showOrgBottlenecks ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <AlertTriangle className="size-4 text-amber-700" /> Overdue & Bottleneck Analytics
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="text-slate-700">Overdue consultant assignments</p>
                  <p className="mt-1 text-xl font-bold text-amber-800">{overview.bottlenecks.overdue_assignments}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="text-slate-700">Delayed closures (&gt;7 days open)</p>
                  <p className="mt-1 text-xl font-bold text-amber-800">{overview.bottlenecks.delayed_closures}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">Longest Pending Letters</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {overview.bottlenecks.longest_pending_letters.map((l) => (
                    <li key={l.letter_id} className="flex justify-between rounded border border-slate-200 px-2 py-1">
                      <span>{l.serial_no} - {l.subject}</span>
                      <span className="font-semibold text-amber-800">{l.days_pending} days</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      </div>

      {overview ? (
        <DashboardAnalyticsPrintSummary
          filterLabel={formatAnalyticsFilterSummary(filters)}
          generatedAt={new Date().toLocaleString()}
          preparedFor={user?.full_name ?? "Officer"}
          overview={overview}
          departments={showDepartments ? depForPrint : null}
          consultants={showConsultants ? conForPrint : null}
          trends={trends}
          showDepartments={showDepartments}
          showConsultants={showConsultants}
          showOrgBottlenecks={showOrgBottlenecks}
          departmentsTruncated={showDepartments ? departmentsTruncated : false}
          consultantsTruncated={showConsultants ? consultantsTruncated : false}
        />
      ) : null}
    </div>
  );
}
