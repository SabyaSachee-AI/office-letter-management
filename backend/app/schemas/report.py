from pydantic import BaseModel, Field


class AnalyticsPeriodOut(BaseModel):
    date_from: str | None = None
    date_to: str | None = None


class AnalyticsOut(BaseModel):
    period: AnalyticsPeriodOut
    total_letters: int
    letters_by_status: dict[str, int] = Field(default_factory=dict)
    letters_by_priority: dict[str, int] = Field(default_factory=dict)
    active_assignments: int
    assignments_by_work_status: dict[str, int] = Field(default_factory=dict)
    closed_letters: int
    avg_days_to_close: float | None = None
    audit_events: int
    logins_success: int
    logins_failed: int
