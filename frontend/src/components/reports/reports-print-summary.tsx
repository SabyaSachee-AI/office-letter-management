import { ASSIGNMENT_WORK_STATUS_LABELS, LETTER_STATUS_LABELS } from "@/lib/workflow-display";
import type { AnalyticsOut } from "@/types/reports";
import type { LetterOut } from "@/types/letter";
import type { LetterStatus } from "@/types/letter";

function statusLabel(s: LetterStatus): string {
  return LETTER_STATUS_LABELS[s] ?? s;
}

type ReportsPrintSummaryProps = {
  title: string;
  filterCaption: string;
  generatedAt: string;
  analytics: AnalyticsOut;
  letters: LetterOut[];
  lettersTotal: number;
};

function kvTable(rows: { label: string; value: number }[]) {
  if (!rows.length) return <p className="m-0 text-[7pt] text-slate-600">No rows.</p>;
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="tabular-nums text-right">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportsPrintSummary({
  title,
  filterCaption,
  generatedAt,
  analytics,
  letters,
  lettersTotal,
}: ReportsPrintSummaryProps) {
  const period =
    analytics.period.date_from && analytics.period.date_to
      ? `${analytics.period.date_from} to ${analytics.period.date_to}`
      : analytics.period.date_from
        ? `From ${analytics.period.date_from}`
        : analytics.period.date_to
          ? `Until ${analytics.period.date_to}`
          : "All time";

  const statusRows = Object.entries(analytics.letters_by_status)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      label:
        k in LETTER_STATUS_LABELS
          ? LETTER_STATUS_LABELS[k as keyof typeof LETTER_STATUS_LABELS]
          : k.replace(/_/g, " "),
      value: v,
    }));
  const priorityRows = Object.entries(analytics.letters_by_priority)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: v }));
  const assignRows = Object.entries(analytics.assignments_by_work_status)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      label:
        k in ASSIGNMENT_WORK_STATUS_LABELS
          ? ASSIGNMENT_WORK_STATUS_LABELS[k as keyof typeof ASSIGNMENT_WORK_STATUS_LABELS]
          : k.replace(/_/g, " "),
      value: v,
    }));

  const truncated = lettersTotal > letters.length;

  return (
    <div className="olm-reports-print-root">
      <header className="border-b border-slate-400 pb-2">
        <h1 className="text-[#123f63]">{title}</h1>
        <p className="m-0 text-[8pt] leading-snug text-slate-700">
          <strong>Filters:</strong> {filterCaption}
        </p>
        <p className="m-0 mt-0.5 text-[7pt] text-slate-600">
          Generated {generatedAt} · Analytics period: {period}
        </p>
      </header>

      <section>
        <h2>Summary</h2>
        <div className="olm-reports-print-metric-grid">
          <div className="metric-cell">
            <div className="text-[7pt] text-slate-600">Letters</div>
            <div className="v tabular-nums">{analytics.total_letters}</div>
          </div>
          <div className="metric-cell">
            <div className="text-[7pt] text-slate-600">Closed</div>
            <div className="v tabular-nums">{analytics.closed_letters}</div>
          </div>
          <div className="metric-cell">
            <div className="text-[7pt] text-slate-600">Active assignments</div>
            <div className="v tabular-nums">{analytics.active_assignments}</div>
          </div>
          <div className="metric-cell">
            <div className="text-[7pt] text-slate-600">Avg. days to close</div>
            <div className="v tabular-nums">
              {analytics.avg_days_to_close != null ? analytics.avg_days_to_close : "—"}
            </div>
          </div>
        </div>
      </section>

      <div className="olm-reports-print-two-col">
        <section>
          <h2>Letter breakdown</h2>
          <p className="m-0 mb-1 text-[7pt] font-semibold text-slate-800">By status</p>
          {kvTable(statusRows)}
          <p className="m-0 mb-1 mt-2 text-[7pt] font-semibold text-slate-800">By priority</p>
          {kvTable(priorityRows)}
        </section>
        <section>
          <h2>Operations</h2>
          <p className="m-0 mb-1 text-[7pt] font-semibold text-slate-800">Assignments by work status</p>
          {kvTable(assignRows)}
          <p className="m-0 mt-2 text-[8pt]">
            <strong>Audit events:</strong> {analytics.audit_events}
            {" · "}
            <strong>Logins (ok / fail):</strong> {analytics.logins_success} / {analytics.logins_failed}
          </p>
        </section>
      </div>

      <section>
        <h2>Letters matching filters</h2>
        {truncated ? (
          <p className="m-0 mb-1 text-[7pt] text-slate-600">
            Showing {letters.length} of {lettersTotal} (see Download Excel for full export).
          </p>
        ) : (
          <p className="m-0 mb-1 text-[7pt] text-slate-600">
            {letters.length} letter{letters.length === 1 ? "" : "s"} in this view.
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Serial</th>
              <th>Memo</th>
              <th>Subject</th>
              <th>From</th>
              <th>Dept</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {letters.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{l.serial_no}</td>
                <td className="whitespace-nowrap">{l.memo_no ?? "—"}</td>
                <td>{l.subject}</td>
                <td>{l.received_from}</td>
                <td>{l.department ? `${l.department.name} (${l.department.code})` : "—"}</td>
                <td>{l.priority}</td>
                <td>{statusLabel(l.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
