import type {
  AnalyticsOverview,
  ConsultantAnalyticsOut,
  DepartmentAnalyticsOut,
  TrendsOut,
} from "@/types/analytics";

type DashboardAnalyticsPrintSummaryProps = {
  filterLabel: string;
  generatedAt: string;
  preparedFor: string;
  overview: AnalyticsOverview;
  departments: DepartmentAnalyticsOut | null;
  consultants: ConsultantAnalyticsOut | null;
  trends: TrendsOut | null;
  showDepartments: boolean;
  showConsultants: boolean;
  showOrgBottlenecks: boolean;
  /** When API cap truncates rows */
  departmentsTruncated?: boolean;
  consultantsTruncated?: boolean;
};

const METRIC_LABELS: { key: keyof AnalyticsOverview["summary"]; label: string }[] = [
  { key: "total_letters", label: "Total letters" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "under_department_processing", label: "Under department processing" },
  { key: "consultant_active_tasks", label: "Consultant active tasks" },
  { key: "waiting_final_closure", label: "Waiting final closure" },
  { key: "officially_closed", label: "Officially closed" },
  { key: "rejected_letters", label: "Rejected" },
  { key: "returned_for_correction", label: "Returned for correction" },
];

export function DashboardAnalyticsPrintSummary({
  filterLabel,
  generatedAt,
  preparedFor,
  overview,
  departments,
  consultants,
  trends,
  showDepartments,
  showConsultants,
  showOrgBottlenecks,
  departmentsTruncated,
  consultantsTruncated,
}: DashboardAnalyticsPrintSummaryProps) {
  const s = overview.summary;
  const trendRows = trends?.letters?.slice(-8) ?? [];

  return (
    <div className="olm-print-summary-root">
      <header className="border-b border-slate-400 pb-2">
        <h1 className="text-[#123f63]">Overview and analytics — print summary</h1>
        <p className="m-0 text-[8pt] leading-snug text-slate-700">
          <strong>Period:</strong> {filterLabel}
          {" · "}
          <strong>Prepared for:</strong> {preparedFor}
          {" · "}
          <strong>Generated:</strong> {generatedAt}
        </p>
        <p className="m-0 mt-0.5 text-[8pt] leading-snug text-slate-600">
          Same filters as on screen. Notice board is not printed. Use “Print summary” on the dashboard (not
          browser scale) for best results.
        </p>
      </header>

      <section>
        <h2 className="text-[10pt] font-semibold text-slate-900">Key metrics</h2>
        <div className="print-summary-metric-grid">
          {METRIC_LABELS.map(({ key, label }) => (
            <div key={key} className="metric-cell">
              <div className="muted text-[7pt] leading-tight">{label}</div>
              <div className="v tabular-nums">{s[key]}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[10pt] font-semibold text-slate-900">Workflow status (counts)</h2>
        <table>
          <thead>
            <tr>
              {overview.workflow_status.items.map((i) => (
                <th key={i.key}>{i.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {overview.workflow_status.items.map((i) => (
                <td key={i.key} className="tabular-nums text-center">
                  {i.count}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <div className="print-summary-two-col">
        {showDepartments && departments && departments.items.length > 0 ? (
          <section>
            <h2 className="text-[10pt] font-semibold text-slate-900">Departments</h2>
            {departmentsTruncated ? (
              <p className="m-0 mb-0.5 text-[7pt] text-slate-600">
                Showing {departments.items.length} of {departments.total} rows (see Export CSV for full list).
              </p>
            ) : null}
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Pending</th>
                  <th className="text-center">Closed</th>
                  <th className="text-center">Avg days</th>
                  <th className="text-center">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {departments.items.map((d) => (
                  <tr key={d.department_id}>
                    <td>
                      {d.department_name} ({d.department_code})
                    </td>
                    <td className="tabular-nums text-center">{d.total_letters}</td>
                    <td className="tabular-nums text-center">{d.pending_count}</td>
                    <td className="tabular-nums text-center">{d.closed_count}</td>
                    <td className="tabular-nums text-center">{d.avg_resolution_days ?? "—"}</td>
                    <td className="tabular-nums text-center">{d.overdue_assignments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {showConsultants && consultants && consultants.items.length > 0 ? (
          <section>
            <h2 className="text-[10pt] font-semibold text-slate-900">Consultants</h2>
            {consultantsTruncated ? (
              <p className="m-0 mb-0.5 text-[7pt] text-slate-600">
                Showing {consultants.items.length} of {consultants.total} rows (see Export CSV for full list).
              </p>
            ) : null}
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-center">Assigned</th>
                  <th className="text-center">Resolved</th>
                  <th className="text-center">Xfer</th>
                  <th className="text-center">Active</th>
                  <th className="text-center">Overdue</th>
                  <th className="text-center">Avg days</th>
                </tr>
              </thead>
              <tbody>
                {consultants.items.map((c) => (
                  <tr key={c.consultant_id}>
                    <td>{c.consultant_name}</td>
                    <td className="tabular-nums text-center">{c.assigned_count}</td>
                    <td className="tabular-nums text-center">{c.resolved_count}</td>
                    <td className="tabular-nums text-center">{c.transferred_count}</td>
                    <td className="tabular-nums text-center">{c.active_workload}</td>
                    <td className="tabular-nums text-center">{c.overdue_tasks}</td>
                    <td className="tabular-nums text-center">{c.avg_completion_days ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[7pt]">
              <div className="rounded border border-slate-300 p-1">
                <p className="m-0 font-semibold">Top performers (resolved)</p>
                <ul className="mt-0.5 list-none space-y-0.5 p-0">
                  {consultants.top_performers.map((p) => (
                    <li key={p.consultant_id} className="flex justify-between gap-2">
                      <span>{p.consultant_name}</span>
                      <span className="tabular-nums">{p.resolved_count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded border border-amber-300 bg-amber-50/80 p-1">
                <p className="m-0 font-semibold text-amber-950">Needs attention (5+ active or any overdue)</p>
                <ul className="mt-0.5 list-none space-y-0.5 p-0">
                  {consultants.overloaded_consultants.length === 0 ? (
                    <li className="text-slate-600">None in this period.</li>
                  ) : (
                    consultants.overloaded_consultants.map((p) => (
                      <li key={p.consultant_id} className="flex justify-between gap-2">
                        <span>{p.consultant_name}</span>
                        <span className="tabular-nums">
                          {p.active_workload} act. / {p.overdue_tasks} ovd.
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {trendRows.length > 0 ? (
        <section>
          <h2 className="text-[10pt] font-semibold text-slate-900">Recent trends (letters)</h2>
          <p className="m-0 mb-0.5 text-[7pt] text-slate-600">Last {trendRows.length} periods in view.</p>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-center">Received</th>
                <th className="text-center">Closed</th>
              </tr>
            </thead>
            <tbody>
              {trendRows.map((t) => (
                <tr key={t.period}>
                  <td>{t.period}</td>
                  <td className="tabular-nums text-center">{t.received}</td>
                  <td className="tabular-nums text-center">{t.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {showOrgBottlenecks ? (
        <section>
          <h2 className="text-[10pt] font-semibold text-slate-900">Risks and oldest open work</h2>
          <p className="m-0 text-[8pt]">
            <strong>Overdue consultant assignments:</strong> {overview.bottlenecks.overdue_assignments}
            {" · "}
            <strong>Delayed closures (over 7 days):</strong> {overview.bottlenecks.delayed_closures}
          </p>
          {overview.bottlenecks.longest_pending_letters.length > 0 ? (
            <table className="mt-1">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Subject</th>
                  <th className="text-center">Days pending</th>
                </tr>
              </thead>
              <tbody>
                {overview.bottlenecks.longest_pending_letters.map((l) => (
                  <tr key={l.letter_id}>
                    <td className="whitespace-nowrap">{l.serial_no}</td>
                    <td>{l.subject}</td>
                    <td className="tabular-nums text-center">{l.days_pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 mt-0.5 text-[7pt] text-slate-600">No longest-pending letters listed for this view.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
