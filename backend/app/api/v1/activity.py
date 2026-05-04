from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import ALL_ROLES, Roles
from app.schemas.activity import (
    AuditLogListResponse,
    AuditLogOut,
    LoginLogListResponse,
    LoginLogOut,
    MarkAllReadResult,
    NotificationListResponse,
    NotificationOut,
)
from app.services.activity_service import ActivityService

router = APIRouter(prefix="/activity", tags=["activity"])

AdminOnly = Depends(require_roles(Roles.ADMIN))


@router.get("/audit-logs", response_model=AuditLogListResponse, dependencies=[AdminOnly])
def list_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None),
    actor_user_id: int | None = Query(default=None),
) -> AuditLogListResponse:
    service = ActivityService(db)
    rows, total = service.list_audit_logs(
        limit=limit, offset=offset, action=action, actor_user_id=actor_user_id
    )
    items: list[AuditLogOut] = []
    for row in rows:
        base = AuditLogOut.model_validate(row)
        actor_email = row.actor.email if row.actor else None
        items.append(base.model_copy(update={"actor_email": actor_email}))
    return AuditLogListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/login-logs", response_model=LoginLogListResponse, dependencies=[AdminOnly])
def list_login_logs(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    email: str | None = Query(default=None),
    success: bool | None = Query(default=None, description="Filter: true=success only, false=failures only"),
) -> LoginLogListResponse:
    service = ActivityService(db)
    rows, total = service.list_login_logs(
        limit=limit, offset=offset, email=email, success_only=success
    )
    items: list[LoginLogOut] = []
    for row in rows:
        base = LoginLogOut.model_validate(row)
        user_email = row.user.email if row.user else None
        items.append(base.model_copy(update={"user_email": user_email}))
    return LoginLogListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/notifications", response_model=NotificationListResponse)
def my_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALL_ROLES))],
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
) -> NotificationListResponse:
    service = ActivityService(db)
    rows, total = service.list_notifications_for_user(
        current_user.id, limit=limit, offset=offset, unread_only=unread_only
    )
    return NotificationListResponse(
        items=[NotificationOut.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALL_ROLES))],
) -> NotificationOut:
    service = ActivityService(db)
    note = service.mark_notification_read(notification_id, current_user.id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return NotificationOut.model_validate(note)


@router.post("/notifications/mark-all-read", response_model=MarkAllReadResult)
def mark_all_notifications_read(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALL_ROLES))],
) -> MarkAllReadResult:
    service = ActivityService(db)
    n = service.mark_all_notifications_read(current_user.id)
    return MarkAllReadResult(marked_count=n)
