from pydantic import BaseModel, Field


class AnalyticsScopeOut(BaseModel):
    role_view: str
    department_id: int | None = None
    user_id: int | None = None


class SummaryCardsOut(BaseModel):
    total_letters: int = 0
    pending_approval: int = 0
    under_department_processing: int = 0
    consultant_active_tasks: int = 0
    waiting_final_closure: int = 0
    officially_closed: int = 0
    rejected_letters: int = 0
    returned_for_correction: int = 0


class DepartmentAnalyticsItemOut(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    total_letters: int = 0
    pending_count: int = 0
    closed_count: int = 0
    overdue_assignments: int = 0
    avg_resolution_days: float | None = None


class DepartmentAnalyticsOut(BaseModel):
    items: list[DepartmentAnalyticsItemOut] = Field(default_factory=list)
    total: int = 0
    limit: int | None = None
    offset: int | None = None


class ConsultantAnalyticsItemOut(BaseModel):
    consultant_id: int
    consultant_name: str
    consultant_email: str
    assigned_count: int = 0
    resolved_count: int = 0
    transferred_count: int = 0
    active_workload: int = 0
    overdue_tasks: int = 0
    avg_completion_days: float | None = None


class ConsultantAnalyticsOut(BaseModel):
    items: list[ConsultantAnalyticsItemOut] = Field(default_factory=list)
    top_performers: list[ConsultantAnalyticsItemOut] = Field(default_factory=list)
    overloaded_consultants: list[ConsultantAnalyticsItemOut] = Field(default_factory=list)
    total: int = 0
    limit: int | None = None
    offset: int | None = None


class WorkflowStatusItemOut(BaseModel):
    key: str
    label: str
    count: int


class WorkflowStatusOut(BaseModel):
    items: list[WorkflowStatusItemOut] = Field(default_factory=list)


class TrendPointOut(BaseModel):
    period: str
    received: int = 0
    closed: int = 0


class DepartmentTrendPointOut(BaseModel):
    period: str
    department_code: str
    letters: int = 0


class ConsultantTrendPointOut(BaseModel):
    period: str
    consultant_id: int
    consultant_name: str
    assignments: int = 0


class TrendsOut(BaseModel):
    letters: list[TrendPointOut] = Field(default_factory=list)
    departments: list[DepartmentTrendPointOut] = Field(default_factory=list)
    consultants: list[ConsultantTrendPointOut] = Field(default_factory=list)


class BottleneckItemOut(BaseModel):
    letter_id: int
    serial_no: str
    subject: str
    department_code: str | None = None
    days_pending: int


class BottleneckOut(BaseModel):
    overdue_assignments: int = 0
    delayed_closures: int = 0
    high_backlog_departments: list[DepartmentAnalyticsItemOut] = Field(default_factory=list)
    longest_pending_letters: list[BottleneckItemOut] = Field(default_factory=list)


class AnalyticsOverviewOut(BaseModel):
    scope: AnalyticsScopeOut
    summary: SummaryCardsOut
    workflow_status: WorkflowStatusOut
    bottlenecks: BottleneckOut
