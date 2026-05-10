export type AnalyticsScope = {
  role_view: string;
  department_id: number | null;
  user_id: number | null;
};

export type SummaryCards = {
  total_letters: number;
  pending_approval: number;
  under_department_processing: number;
  consultant_active_tasks: number;
  waiting_final_closure: number;
  officially_closed: number;
  rejected_letters: number;
  returned_for_correction: number;
};

export type WorkflowStatusItem = {
  key: string;
  label: string;
  count: number;
};

export type DepartmentAnalyticsItem = {
  department_id: number;
  department_name: string;
  department_code: string;
  total_letters: number;
  pending_count: number;
  closed_count: number;
  overdue_assignments: number;
  avg_resolution_days: number | null;
};

export type ConsultantAnalyticsItem = {
  consultant_id: number;
  consultant_name: string;
  consultant_email: string;
  assigned_count: number;
  resolved_count: number;
  transferred_count: number;
  active_workload: number;
  overdue_tasks: number;
  avg_completion_days: number | null;
};

export type TrendPoint = {
  period: string;
  received: number;
  closed: number;
};

export type DepartmentTrendPoint = {
  period: string;
  department_code: string;
  letters: number;
};

export type ConsultantTrendPoint = {
  period: string;
  consultant_id: number;
  consultant_name: string;
  assignments: number;
};

export type BottleneckItem = {
  letter_id: number;
  serial_no: string;
  subject: string;
  department_code: string | null;
  days_pending: number;
};

export type AnalyticsOverview = {
  scope: AnalyticsScope;
  summary: SummaryCards;
  workflow_status: { items: WorkflowStatusItem[] };
  bottlenecks: {
    overdue_assignments: number;
    delayed_closures: number;
    high_backlog_departments: DepartmentAnalyticsItem[];
    longest_pending_letters: BottleneckItem[];
  };
};

export type AnalyticsTablePaging = {
  limit: number;
  offset: number;
  sort_by: string;
  sort_dir: "asc" | "desc";
};

export type DepartmentAnalyticsOut = {
  items: DepartmentAnalyticsItem[];
  total: number;
  limit: number | null;
  offset: number | null;
};

export type ConsultantAnalyticsOut = {
  items: ConsultantAnalyticsItem[];
  top_performers: ConsultantAnalyticsItem[];
  overloaded_consultants: ConsultantAnalyticsItem[];
  total: number;
  limit: number | null;
  offset: number | null;
};
export type TrendsOut = {
  letters: TrendPoint[];
  departments: DepartmentTrendPoint[];
  consultants: ConsultantTrendPoint[];
};

export type AnalyticsFilters = {
  preset?: string;
  date_from?: string;
  date_to?: string;
  department_id?: number;
};
