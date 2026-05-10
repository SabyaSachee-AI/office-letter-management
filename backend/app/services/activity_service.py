import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.activity import AuditLog, LoginLog, Notification, NotificationKind
from app.models.role import Role
from app.models.user import User
from app.models.user import UserStatus
from app.rbac.roles import Roles
from app.schemas.activity import (
    AuditLogResolvedAssignmentOut,
    AuditLogResolvedContextOut,
    AuditLogResolvedDepartmentOut,
    AuditLogResolvedLetterOut,
    AuditLogResolvedUserOut,
)
from app.services.audit_log_service import AuditLogService


def _parse_audit_json_blob(raw: str | None) -> dict[str, Any]:
    if raw is None or not str(raw).strip():
        return {}
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except json.JSONDecodeError:
        return {}


def _as_int(v: Any) -> int | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return None


class ActivityService:
    def __init__(self, db: Session):
        self.db = db

    def record_audit(
        self,
        *,
        actor_user_id: int | None,
        action: str,
        module: str | None = None,
        description: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        detail: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        AuditLogService(self.db).log_safe(
            actor_user_id=actor_user_id,
            action=action,
            module=module or resource_type,
            description=description or (detail or {}).get("description"),
            entity_type=entity_type or resource_type,
            entity_id=entity_id if entity_id is not None else resource_id,
            old_value=old_value,
            new_value=new_value,
            detail=detail,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type=resource_type,
            resource_id=resource_id,
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
        event_code: str | None = None,
        route_module: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
    ) -> Notification:
        note = Notification(
            user_id=user_id,
            kind=kind,
            title=title[:255],
            body=body,
            letter_id=letter_id,
            link_path=(link_path[:512] if link_path else None),
            event_code=(event_code[:64] if event_code else None),
            route_module=(route_module[:32] if route_module else None),
            entity_type=(entity_type[:64] if entity_type else None),
            entity_id=entity_id,
        )
        self.db.add(note)
        return note

    def _active_user_ids_with_role(self, role_name: str) -> list[int]:
        return list(
            self.db.scalars(
                select(User.id)
                .join(User.roles)
                .where(
                    User.status == UserStatus.ACTIVE,
                    Role.name == role_name,
                    Role.is_active.is_(True),
                )
            ).all()
        )

    def create_notifications_bulk(
        self,
        *,
        user_ids: list[int],
        kind: NotificationKind,
        title: str,
        body: str,
        letter_id: int | None = None,
        link_path: str | None = None,
        exclude_user_ids: set[int] | None = None,
        event_code: str | None = None,
        route_module: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
    ) -> int:
        blocked = exclude_user_ids or set()
        count = 0
        for uid in sorted(set(user_ids)):
            if uid in blocked:
                continue
            self.create_notification(
                user_id=uid,
                kind=kind,
                title=title,
                body=body,
                letter_id=letter_id,
                link_path=link_path,
                event_code=event_code,
                route_module=route_module,
                entity_type=entity_type,
                entity_id=entity_id,
            )
            count += 1
        return count

    def notify_approval_heads_for_received_letter(
        self,
        *,
        letter_id: int,
        serial_no: str,
        subject: str,
    ) -> int:
        users = self._active_user_ids_with_role(Roles.APPROVAL_HEAD_PEC)
        return self.create_notifications_bulk(
            user_ids=users,
            kind=NotificationKind.SYSTEM,
            title=f"New received letter: {serial_no}",
            body=subject,
            letter_id=letter_id,
            link_path=f"/dashboard/approval/{letter_id}",
            event_code="letter.received",
            route_module="approval",
            entity_type="letter",
            entity_id=letter_id,
        )

    def notify_team_leaders_for_department(
        self,
        *,
        department_id: int,
        letter_id: int,
        serial_no: str,
        subject: str,
        title_prefix: str = "Letter routed",
        event_code: str | None = None,
    ) -> int:
        users = list(
            self.db.scalars(
                select(User.id)
                .join(User.roles)
                .where(
                    User.status == UserStatus.ACTIVE,
                    Role.name == Roles.TEAM_LEADER,
                    Role.is_active.is_(True),
                    User.team_department_id == department_id,
                )
            ).all()
        )
        return self.create_notifications_bulk(
            user_ids=users,
            kind=NotificationKind.SYSTEM,
            title=f"{title_prefix}: {serial_no}",
            body=subject,
            letter_id=letter_id,
            link_path=f"/dashboard/assignment/{letter_id}",
            event_code=event_code or "letter.routed",
            route_module="assignment",
            entity_type="letter",
            entity_id=letter_id,
        )

    def notify_receiving_and_related_on_close(
        self,
        *,
        letter_id: int,
        serial_no: str,
        subject: str,
        creator_user_id: int,
        related_user_ids: list[int] | None = None,
        exclude_user_ids: set[int] | None = None,
    ) -> int:
        receiving = self._active_user_ids_with_role(Roles.RECEIVING_OFFICER)
        users = set(receiving)
        users.add(creator_user_id)
        if related_user_ids:
            users.update(related_user_ids)
        return self.create_notifications_bulk(
            user_ids=list(users),
            kind=NotificationKind.LETTER_CLOSED,
            title=f"Letter closed: {serial_no}",
            body=f"The issue for «{subject}» was formally closed.",
            letter_id=letter_id,
            link_path=f"/dashboard/closure/{letter_id}",
            exclude_user_ids=exclude_user_ids,
            event_code="letter.closed",
            route_module="closure",
            entity_type="letter",
            entity_id=letter_id,
        )

    def list_audit_logs(
        self,
        *,
        limit: int,
        offset: int,
        action: str | None = None,
        actor_user_id: int | None = None,
        module: str | None = None,
        user_q: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog).options(selectinload(AuditLog.actor))
        count_stmt = select(func.count(AuditLog.id))
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)
        if actor_user_id is not None:
            stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
            count_stmt = count_stmt.where(AuditLog.actor_user_id == actor_user_id)
        if module:
            stmt = stmt.where(AuditLog.module == module)
            count_stmt = count_stmt.where(AuditLog.module == module)
        if user_q:
            q = f"%{user_q.strip()}%"
            stmt = stmt.where((AuditLog.user_name.ilike(q)) | (AuditLog.role.ilike(q)))
            count_stmt = count_stmt.where((AuditLog.user_name.ilike(q)) | (AuditLog.role.ilike(q)))
        if date_from is not None:
            stmt = stmt.where(AuditLog.created_at >= date_from)
            count_stmt = count_stmt.where(AuditLog.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(AuditLog.created_at <= date_to)
            count_stmt = count_stmt.where(AuditLog.created_at <= date_to)
        total = self.db.scalar(count_stmt) or 0
        rows = list(
            self.db.scalars(
                stmt.order_by(AuditLog.id.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def resolve_audit_log_contexts(self, rows: list[AuditLog]) -> dict[int, AuditLogResolvedContextOut | None]:
        """Batch-resolve user / department / letter / assignment labels for a page of audit rows."""
        from app.models.department import Department
        from app.models.letter import Letter, LetterAssignment

        if not rows:
            return {}

        user_ids: set[int] = set()
        dept_ids: set[int] = set()
        letter_ids: set[int] = set()
        assignment_ids: set[int] = set()
        merged_by_audit: dict[int, dict[str, Any]] = {}

        for row in rows:
            merged = {
                **_parse_audit_json_blob(row.new_value),
                **_parse_audit_json_blob(row.old_value),
                **_parse_audit_json_blob(row.detail_json),
            }
            merged_by_audit[row.id] = merged

            if row.resource_type == "letter" and row.resource_id is not None:
                letter_ids.add(int(row.resource_id))
            if row.entity_type == "letter" and row.entity_id is not None:
                letter_ids.add(int(row.entity_id))

            if row.resource_type == "assignment" and row.resource_id is not None:
                assignment_ids.add(int(row.resource_id))

            uid = _as_int(merged.get("consultant_id"))
            if uid is not None:
                user_ids.add(uid)
            tid = _as_int(merged.get("target_consultant_id"))
            if tid is None:
                tid = _as_int(merged.get("target_user_id"))
            if tid is not None:
                user_ids.add(tid)
            prev_a = _as_int(merged.get("previous_assignee_id"))
            if prev_a is not None:
                user_ids.add(prev_a)

            dep_raw = merged.get("target_department_id")
            if dep_raw is None:
                dep_raw = merged.get("department_id")
            did = _as_int(dep_raw)
            if did is not None:
                dept_ids.add(did)

            aid = _as_int(merged.get("assignment_id"))
            if aid is not None:
                assignment_ids.add(aid)

        umap: dict[int, User] = {}
        if user_ids:
            for u in self.db.scalars(select(User).where(User.id.in_(user_ids))).all():
                umap[u.id] = u

        dmap: dict[int, Department] = {}
        if dept_ids:
            for d in self.db.scalars(select(Department).where(Department.id.in_(dept_ids))).all():
                dmap[d.id] = d

        amap: dict[int, LetterAssignment] = {}
        if assignment_ids:
            for a in self.db.scalars(
                select(LetterAssignment).where(LetterAssignment.id.in_(assignment_ids))
            ).all():
                amap[a.id] = a
                if a.letter_id is not None:
                    letter_ids.add(int(a.letter_id))

        lmap: dict[int, Letter] = {}
        if letter_ids:
            for L in self.db.scalars(select(Letter).where(Letter.id.in_(letter_ids))).all():
                lmap[L.id] = L

        def user_out(uid: int | None) -> AuditLogResolvedUserOut | None:
            if uid is None or uid not in umap:
                return None
            u = umap[uid]
            return AuditLogResolvedUserOut(id=u.id, full_name=u.full_name, email=str(u.email))

        def letter_out(lid: int | None) -> AuditLogResolvedLetterOut | None:
            if lid is None or lid not in lmap:
                return None
            L = lmap[lid]
            return AuditLogResolvedLetterOut(id=L.id, serial_no=L.serial_no, subject=L.subject)

        def dept_out(did: int | None) -> AuditLogResolvedDepartmentOut | None:
            if did is None or did not in dmap:
                return None
            d = dmap[did]
            return AuditLogResolvedDepartmentOut(id=d.id, name=d.name, code=d.code)

        out: dict[int, AuditLogResolvedContextOut | None] = {}
        for row in rows:
            merged = merged_by_audit[row.id]
            ctx = AuditLogResolvedContextOut()

            lid: int | None = None
            if row.resource_type == "letter" and row.resource_id is not None:
                lid = int(row.resource_id)
            elif row.entity_type == "letter" and row.entity_id is not None:
                lid = int(row.entity_id)

            aid = _as_int(merged.get("assignment_id"))
            if aid is None and row.resource_type == "assignment" and row.resource_id is not None:
                aid = int(row.resource_id)

            if aid is not None and aid in amap:
                la = amap[aid]
                ctx.assignment = AuditLogResolvedAssignmentOut(id=aid, letter_id=la.letter_id)
                if lid is None and la.letter_id is not None:
                    lid = int(la.letter_id)

            if lid is not None:
                lo = letter_out(lid)
                if lo:
                    ctx.letter = lo

            cid = _as_int(merged.get("consultant_id"))
            if cid is not None:
                ctx.consultant = user_out(cid)

            tcid = _as_int(merged.get("target_consultant_id"))
            if tcid is None:
                tcid = _as_int(merged.get("target_user_id"))
            if tcid is not None:
                ctx.target_consultant = user_out(tcid)

            dep_key = merged.get("target_department_id")
            if dep_key is None:
                dep_key = merged.get("department_id")
            did = _as_int(dep_key)
            if did is not None:
                ctx.department = dept_out(did)

            if any(
                (
                    ctx.consultant,
                    ctx.target_consultant,
                    ctx.department,
                    ctx.letter,
                    ctx.assignment,
                )
            ):
                out[row.id] = ctx
            else:
                out[row.id] = None

        return out

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

    def get_audit_filter_options(self) -> tuple[list[str], list[str]]:
        modules = list(
            self.db.scalars(
                select(AuditLog.module)
                .where(AuditLog.module.is_not(None), AuditLog.module != "")
                .distinct()
                .order_by(AuditLog.module.asc())
            ).all()
        )
        actions = list(
            self.db.scalars(
                select(AuditLog.action)
                .where(AuditLog.action.is_not(None), AuditLog.action != "")
                .distinct()
                .order_by(AuditLog.action.asc())
            ).all()
        )
        return modules, actions

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

    def count_unread_notifications(self, user_id: int) -> int:
        return int(
            self.db.scalar(
                select(func.count(Notification.id)).where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
            or 0
        )

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
