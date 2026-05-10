import csv
import io
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.analytics import (
    AnalyticsOverviewOut,
    BottleneckOut,
    ConsultantAnalyticsOut,
    DepartmentAnalyticsOut,
    TrendsOut,
    WorkflowStatusOut,
)
from app.services.analytics_service import AnalyticsFilters, AnalyticsService, TablePaging

router = APIRouter(prefix="/analytics", tags=["analytics"])

AnalyticsActors = Depends(
    require_roles(
        Roles.SYSTEM_ADMIN,
        Roles.APPROVAL_HEAD_PEC,
        Roles.TEAM_LEADER,
        Roles.CONSULTANT,
        Roles.RECEIVING_OFFICER,
    )
)


def _filters(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    preset: str | None = Query(default="30d"),
    department_id: int | None = Query(default=None),
) -> AnalyticsFilters:
    return AnalyticsFilters(date_from=date_from, date_to=date_to, preset=preset, department_id=department_id)


@router.get("/overview", response_model=AnalyticsOverviewOut)
def analytics_overview(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
) -> AnalyticsOverviewOut:
    try:
        return AnalyticsService(db).get_overview(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


def _table_paging(
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sort_by: str | None = Query(default=None),
    sort_dir: str = Query(default="desc"),
) -> TablePaging | None:
    if limit is None:
        return None
    return TablePaging(limit=limit, offset=offset, sort_by=sort_by or "", sort_dir=sort_dir)


@router.get("/departments", response_model=DepartmentAnalyticsOut)
def analytics_departments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
    paging: Annotated[TablePaging | None, Depends(_table_paging)],
) -> DepartmentAnalyticsOut:
    try:
        return AnalyticsService(db).get_departments(current_user, filters, paging)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/consultants", response_model=ConsultantAnalyticsOut)
def analytics_consultants(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
    paging: Annotated[TablePaging | None, Depends(_table_paging)],
) -> ConsultantAnalyticsOut:
    try:
        return AnalyticsService(db).get_consultants(current_user, filters, paging)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/workflow-status", response_model=WorkflowStatusOut)
def analytics_workflow_status(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
) -> WorkflowStatusOut:
    try:
        return AnalyticsService(db).get_workflow_status(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/trends", response_model=TrendsOut)
def analytics_trends(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
) -> TrendsOut:
    try:
        return AnalyticsService(db).get_trends(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/bottlenecks", response_model=BottleneckOut)
def analytics_bottlenecks(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
) -> BottleneckOut:
    try:
        return AnalyticsService(db).get_bottlenecks(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/export.csv")
def analytics_export_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, AnalyticsActors],
    filters: Annotated[AnalyticsFilters, Depends(_filters)],
) -> Response:
    service = AnalyticsService(db)
    overview = service.get_overview(current_user, filters)
    departments = service.get_departments(current_user, filters)
    consultants = service.get_consultants(current_user, filters)
    workflow = service.get_workflow_status(current_user, filters)
    trends = service.get_trends(current_user, filters)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["section", "metric", "value"])
    writer.writerow(["filter", "preset", filters.preset or ""])
    writer.writerow(["filter", "date_from", str(filters.date_from or "")])
    writer.writerow(["filter", "date_to", str(filters.date_to or "")])
    writer.writerow(["filter", "department_id", str(filters.department_id or "")])
    for k, v in overview.summary.model_dump().items():
        writer.writerow(["summary", k, v])
    for ws in workflow.items:
        writer.writerow(["workflow_status", ws.label, ws.count])
    writer.writerow(["bottleneck", "overdue_assignments", overview.bottlenecks.overdue_assignments])
    writer.writerow(["bottleneck", "delayed_closures", overview.bottlenecks.delayed_closures])
    for l in overview.bottlenecks.longest_pending_letters:
        writer.writerow(
            [
                "longest_pending_letter",
                l.serial_no,
                f"days_pending={l.days_pending};subject={l.subject};dept={l.department_code or ''}",
            ]
        )
    for d in departments.items:
        writer.writerow(["department", d.department_code, d.total_letters])
        writer.writerow(["department_pending", d.department_code, d.pending_count])
        writer.writerow(["department_closed", d.department_code, d.closed_count])
        writer.writerow(["department_overdue_assignments", d.department_code, d.overdue_assignments])
        writer.writerow(["department_avg_resolution_days", d.department_code, d.avg_resolution_days or ""])
    for c in consultants.items:
        writer.writerow(["consultant_name", c.consultant_email, c.consultant_name])
        writer.writerow(["consultant_assigned", c.consultant_email, c.assigned_count])
        writer.writerow(["consultant_resolved", c.consultant_email, c.resolved_count])
        writer.writerow(["consultant_transferred", c.consultant_email, c.transferred_count])
        writer.writerow(["consultant_active_workload", c.consultant_email, c.active_workload])
        writer.writerow(["consultant_overdue", c.consultant_email, c.overdue_tasks])
        writer.writerow(["consultant_avg_completion_days", c.consultant_email, c.avg_completion_days or ""])
    for t in trends.letters:
        writer.writerow(["trend_letters", t.period, f"received={t.received};closed={t.closed}"])
    for t in trends.departments:
        writer.writerow(["trend_department", f"{t.period}|{t.department_code}", t.letters])
    for t in trends.consultants:
        writer.writerow(
            ["trend_consultant", f"{t.period}|{t.consultant_id}", f"{t.consultant_name}={t.assignments}"]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="dashboard-analytics.csv"'},
    )
