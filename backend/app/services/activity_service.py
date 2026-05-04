import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.activity import AuditLog, LoginLog, Notification, NotificationKind
from app.models.user import User


class ActivityService:
    def __init__(self, db: Session):
        self.db = db

    def record_audit(
        self,
        *,
        actor_user_id: int | None,
        action: str,
        resource_type: str | None = None,
        resource_id: int | None = None,
        detail: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        self.db.add(
            AuditLog(
                actor_user_id=actor_user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                detail_json=json.dumps(detail) if detail else None,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )

    def record_login(
        self,
        *,
        email_attempted: str,
        user_id: int | None,
        success: bool,
        ip_address: str | None = None,
        user_agent: str | None = None,
        failure_reason: str | None = None,
    ) -> None:
        self.db.add(
            LoginLog(
                email_attempted=email_attempted[:255],
                user_id=user_id,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=(failure_reason[:255] if failure_reason else None),
            )
        )

    def create_notification(
        self,
        *,
        user_id: int,
        kind: NotificationKind,
        title: str,
        body: str,
        letter_id: int | None = None,
        link_path: str | None = None,
    ) -> Notification:
        note = Notification(
            user_id=user_id,
            kind=kind,
            title=title[:255],
            body=body,
            letter_id=letter_id,
            link_path=(link_path[:512] if link_path else None),
        )
        self.db.add(note)
        return note

    def list_audit_logs(
        self,
        *,
        limit: int,
        offset: int,
        action: str | None = None,
        actor_user_id: int | None = None,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog).options(selectinload(AuditLog.actor))
        count_stmt = select(func.count(AuditLog.id))
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)
        if actor_user_id is not None:
            stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
            count_stmt = count_stmt.where(AuditLog.actor_user_id == actor_user_id)
        total = self.db.scalar(count_stmt) or 0
        rows = list(
            self.db.scalars(
                stmt.order_by(AuditLog.id.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def list_login_logs(
        self,
        *,
        limit: int,
        offset: int,
        email: str | None = None,
        success_only: bool | None = None,
    ) -> tuple[list[LoginLog], int]:
        stmt = select(LoginLog).options(selectinload(LoginLog.user))
        count_stmt = select(func.count(LoginLog.id))
        if email:
            stmt = stmt.where(LoginLog.email_attempted.ilike(f"%{email.strip()}%"))
            count_stmt = count_stmt.where(LoginLog.email_attempted.ilike(f"%{email.strip()}%"))
        if success_only is True:
            stmt = stmt.where(LoginLog.success.is_(True))
            count_stmt = count_stmt.where(LoginLog.success.is_(True))
        elif success_only is False:
            stmt = stmt.where(LoginLog.success.is_(False))
            count_stmt = count_stmt.where(LoginLog.success.is_(False))
        total = self.db.scalar(count_stmt) or 0
        rows = list(
            self.db.scalars(
                stmt.order_by(LoginLog.id.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def list_notifications_for_user(
        self,
        user_id: int,
        *,
        limit: int,
        offset: int,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        count_stmt = select(func.count(Notification.id)).where(Notification.user_id == user_id)
        if unread_only:
            base = base.where(Notification.read_at.is_(None))
            count_stmt = count_stmt.where(Notification.read_at.is_(None))
        total = self.db.scalar(count_stmt) or 0
        rows = list(
            self.db.scalars(
                base.order_by(Notification.id.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def mark_notification_read(self, notification_id: int, user_id: int) -> Notification | None:
        note = self.db.get(Notification, notification_id)
        if note is None or note.user_id != user_id:
            return None
        from datetime import datetime, timezone

        if note.read_at is None:
            note.read_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(note)
        return note

    def mark_all_notifications_read(self, user_id: int) -> int:
        now = datetime.now(timezone.utc)
        notes = list(
            self.db.scalars(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            ).all()
        )
        for n in notes:
            n.read_at = now
        if notes:
            self.db.commit()
        return len(notes)
