export type AnalyticsPeriod = {
  date_from: string | null;
  date_to: string | null;
};

export type AnalyticsOut = {
  period: AnalyticsPeriod;
  total_letters: number;
  letters_by_status: Record<string, number>;
  letters_by_priority: Record<string, number>;
  active_assignments: number;
  assignments_by_work_status: Record<string, number>;
  closed_letters: number;
  avg_days_to_close: number | null;
  audit_events: number;
  logins_success: number;
  logins_failed: number;
};

export type ReportQueryParams = {
  date_from?: string;
  date_to?: string;
  department_id?: number;
  status?: string;
};
