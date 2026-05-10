from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.department import Department
from app.models.letter import LetterStatus
from app.models.user import User
from app.rbac.guards import require_any_permission, require_roles
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles
from app.schemas.report import AnalyticsOut
from app.services.export_service import (
    build_letters_pdf,
    build_letters_xlsx,
    format_letters_filter_caption,
    letter_row_from_model,
)
from app.services.report_service import ReportFilters, ReportsService
from app.services.audit_log_service import AuditLogService

router = APIRouter(prefix="/reports", tags=["reports"])

EXPORT_TITLE = "Letters export (according to filter)"


def _department_export_label(db: Session, department_id: int | None) -> str | None:
    if department_id is None:
        return None
    row = db.get(Department, department_id)
    return row.name if row else None


def _parse_filters(
    date_from: date | None,
    date_to: date | None,
    department_id: int | None,
    status: LetterStatus | None,
    q: str | None,
    from_office: str | None,
) -> ReportFilters:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be before or equal to date_to",
        )
    return ReportFilters(
        date_from=date_from,
        date_to=date_to,
        department_id=department_id,
        status=status,
        q=(q.strip() or None) if q is not None else None,
        from_office=(from_office.strip() or None) if from_office is not None else None,
    )


@router.get(
    "/analytics",
    response_model=AnalyticsOut,
    dependencies=[Depends(require_any_permission(PermissionKey.REPORTS_VIEW))],
)
def reports_analytics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.RECEIVING_OFFICER, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER, Roles.CONSULTANT))],
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    department_id: int | None = Query(default=None),
    status: LetterStatus | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    from_office: str | None = Query(default=None, max_length=255),
) -> AnalyticsOut:
    filters = _parse_filters(date_from, date_to, department_id, status, q, from_office)
    try:
        data = ReportsService(db).get_analytics(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return AnalyticsOut.model_validate(data)


@router.get(
    "/export/letters.pdf",
    dependencies=[Depends(require_any_permission(PermissionKey.REPORTS_EXPORT))],
)
def export_letters_pdf(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.RECEIVING_OFFICER, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER, Roles.CONSULTANT))],
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    department_id: int | None = Query(default=None),
    status: LetterStatus | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    from_office: str | None = Query(default=None, max_length=255),
) -> Response:
    audits = AuditLogService(db)
    filters = _parse_filters(date_from, date_to, department_id, status, q, from_office)
    try:
        letters = ReportsService(db).list_letters_for_export(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    rows = [letter_row_from_model(L) for L in letters]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    dept_label = _department_export_label(db, filters.department_id)
    filter_caption = format_letters_filter_caption(filters, department_name=dept_label)
    pdf = build_letters_pdf(rows, title=EXPORT_TITLE, filter_caption=filter_caption)
    filename = f"letters-export-{stamp}.pdf"
    audits.log_safe(
        actor_user_id=current_user.id,
        actor_user_name=current_user.full_name,
        module="reports",
        action="export_pdf",
        description="Exported letters report as PDF",
        entity_type="report",
        new_value={"row_count": len(rows), "filters": filters.__dict__},
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/letters.xlsx",
    dependencies=[Depends(require_any_permission(PermissionKey.REPORTS_EXPORT))],
)
def export_letters_xlsx(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.RECEIVING_OFFICER, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER, Roles.CONSULTANT))],
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    department_id: int | None = Query(default=None),
    status: LetterStatus | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    from_office: str | None = Query(default=None, max_length=255),
) -> Response:
    audits = AuditLogService(db)
    filters = _parse_filters(date_from, date_to, department_id, status, q, from_office)
    try:
        letters = ReportsService(db).list_letters_for_export(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    rows = [letter_row_from_model(L) for L in letters]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    dept_label = _department_export_label(db, filters.department_id)
    filter_caption = format_letters_filter_caption(filters, department_name=dept_label)
    xlsx = build_letters_xlsx(rows, title=EXPORT_TITLE, filter_caption=filter_caption)
    filename = f"letters-export-{stamp}.xlsx"
    audits.log_safe(
        actor_user_id=current_user.id,
        actor_user_name=current_user.full_name,
        module="reports",
        action="export_xlsx",
        description="Exported letters report as XLSX",
        entity_type="report",
        new_value={"row_count": len(rows), "filters": filters.__dict__},
    )
    db.commit()
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
