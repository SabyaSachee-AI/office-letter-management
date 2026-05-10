import csv
import io
import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_any_permission
from app.rbac.permissions import PermissionKey
from app.schemas.activity import (
    AuditLogFilterOptionsOut,
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

SecurityLogsAccess = [Depends(require_any_permission(PermissionKey.SECURITY_VIEW))]


@router.get("/audit-logs", response_model=AuditLogListResponse, dependencies=SecurityLogsAccess)
def list_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None),
    module: str | None = Query(default=None),
    user: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    actor_user_id: int | None = Query(default=None),
) -> AuditLogListResponse:
    service = ActivityService(db)
    rows, total = service.list_audit_logs(
        limit=limit,
        offset=offset,
        action=action,
        actor_user_id=actor_user_id,
        module=module,
        user_q=user,
        date_from=date_from,
        date_to=date_to,
    )
    resolved_by_id = service.resolve_audit_log_contexts(rows)
    items: list[AuditLogOut] = []
    for row in rows:
        base = AuditLogOut.model_validate(row)
        actor_email = row.actor.email if row.actor else None
        items.append(
            base.model_copy(
                update={"actor_email": actor_email, "resolved": resolved_by_id.get(row.id)}
            )
        )
    return AuditLogListResponse(items=items, total=total, limit=limit, offset=offset)


_MAX_AUDIT_EXPORT_ROWS = 10_000


@router.get("/audit-logs/export.csv", dependencies=SecurityLogsAccess)
def export_audit_logs_csv(
    db: Annotated[Session, Depends(get_db)],
    action: str | None = Query(default=None),
    module: str | None = Query(default=None),
    user: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    actor_user_id: int | None = Query(default=None),
) -> Response:
    """Download audit logs as CSV (UTF-8 with BOM for Excel). Respects the same filters as the list view. Max rows capped server-side."""
    service = ActivityService(db)
    _, total = service.list_audit_logs(
        limit=1,
        offset=0,
        action=action,
        actor_user_id=actor_user_id,
        module=module,
        user_q=user,
        date_from=date_from,
        date_to=date_to,
    )
    cap = min(_MAX_AUDIT_EXPORT_ROWS, max(total, 0))
    if cap == 0:
        rows = []
    else:
        rows, _ = service.list_audit_logs(
            limit=cap,
            offset=0,
            action=action,
            actor_user_id=actor_user_id,
            module=module,
            user_q=user,
            date_from=date_from,
            date_to=date_to,
        )
    resolved_by_id = service.resolve_audit_log_contexts(rows)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "created_at_utc",
            "user_name",
            "role",
            "actor_email",
            "module",
            "action",
            "description",
            "entity_type",
            "entity_id",
            "resource_type",
            "resource_id",
            "ip_address",
            "detail_json",
            "new_value",
            "old_value",
            "resolved_context_json",
        ]
    )
    for row in rows:
        actor_email = row.actor.email if row.actor else None
        res = resolved_by_id.get(row.id)
        res_json = json.dumps(res.model_dump(exclude_none=True), ensure_ascii=False) if res else ""
        writer.writerow(
            [
                row.id,
                row.created_at.astimezone(timezone.utc).isoformat() if row.created_at else "",
                row.user_name or "",
                row.role or "",
                actor_email or "",
                row.module or "",
                row.action,
                row.description or "",
                row.entity_type or "",
                row.entity_id if row.entity_id is not None else "",
                row.resource_type or "",
                row.resource_id if row.resource_id is not None else "",
                row.ip_address or "",
                row.detail_json or "",
                row.new_value or "",
                row.old_value or "",
                res_json,
            ]
        )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    filename = f"audit-logs-{stamp}-utc.csv"
    body = "\ufeff" + buffer.getvalue()
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/audit-logs/filter-options",
    response_model=AuditLogFilterOptionsOut,
    dependencies=SecurityLogsAccess,
)
def get_audit_log_filter_options(
    db: Annotated[Session, Depends(get_db)],
) -> AuditLogFilterOptionsOut:
    modules, actions = ActivityService(db).get_audit_filter_options()
    return AuditLogFilterOptionsOut(modules=modules, actions=actions)


@router.get("/login-logs", response_model=LoginLogListResponse, dependencies=SecurityLogsAccess)
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


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    dependencies=[Depends(require_any_permission(PermissionKey.NOTIFICATIONS_VIEW))],
)
def my_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
) -> NotificationListResponse:
    service = ActivityService(db)
    rows, total = service.list_notifications_for_user(
        current_user.id, limit=limit, offset=offset, unread_only=unread_only
    )
    unread_total = service.count_unread_notifications(current_user.id)
    items: list[NotificationOut] = []
    for r in rows:
        base = NotificationOut.model_validate(r)
        items.append(
            base.model_copy(
                update={
                    "type": r.kind.value,
                    "message": r.body,
                    "link_url": r.link_path,
                    "is_read": r.read_at is not None,
                }
            )
        )
    return NotificationListResponse(
        items=items, total=total, limit=limit, offset=offset, unread_total=unread_total
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    dependencies=[Depends(require_any_permission(PermissionKey.NOTIFICATIONS_VIEW))],
)
def mark_notification_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationOut:
    service = ActivityService(db)
    note = service.mark_notification_read(notification_id, current_user.id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    base = NotificationOut.model_validate(note)
    return base.model_copy(
        update={
            "type": note.kind.value,
            "message": note.body,
            "link_url": note.link_path,
            "is_read": note.read_at is not None,
        }
    )


@router.patch(
    "/notifications/mark-all-read",
    response_model=MarkAllReadResult,
    dependencies=[Depends(require_any_permission(PermissionKey.NOTIFICATIONS_VIEW))],
)
def mark_all_notifications_read(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MarkAllReadResult:
    service = ActivityService(db)
    n = service.mark_all_notifications_read(current_user.id)
    return MarkAllReadResult(marked_count=n)


@router.post(
    "/notifications/mark-all-read",
    response_model=MarkAllReadResult,
    dependencies=[Depends(require_any_permission(PermissionKey.NOTIFICATIONS_VIEW))],
)
def mark_all_notifications_read_legacy(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MarkAllReadResult:
    service = ActivityService(db)
    n = service.mark_all_notifications_read(current_user.id)
    return MarkAllReadResult(marked_count=n)
