from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.letter import LetterStatus
from app.models.user import User
from app.rbac.guards import require_roles, require_screen
from app.rbac.roles import Roles
from app.rbac.screens import ScreenKey
from app.schemas.report import AnalyticsOut
from app.services.export_service import build_letters_pdf, build_letters_xlsx, letter_row_from_model
from app.services.report_service import ReportFilters, ReportsService

router = APIRouter(prefix="/reports", tags=["reports"])


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
    dependencies=[Depends(require_screen(ScreenKey.REPORTS))],
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
    dependencies=[Depends(require_screen(ScreenKey.REPORTS))],
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
    filters = _parse_filters(date_from, date_to, department_id, status, q, from_office)
    try:
        letters = ReportsService(db).list_letters_for_export(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    rows = [letter_row_from_model(L) for L in letters]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    title = f"Letters export (generated {stamp} UTC)"
    pdf = build_letters_pdf(rows, title=title)
    filename = f"letters-export-{stamp}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/letters.xlsx",
    dependencies=[Depends(require_screen(ScreenKey.REPORTS))],
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
    filters = _parse_filters(date_from, date_to, department_id, status, q, from_office)
    try:
        letters = ReportsService(db).list_letters_for_export(current_user, filters)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    rows = [letter_row_from_model(L) for L in letters]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    title = f"Letters export (generated {stamp} UTC)"
    xlsx = build_letters_xlsx(rows, title=title)
    filename = f"letters-export-{stamp}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
