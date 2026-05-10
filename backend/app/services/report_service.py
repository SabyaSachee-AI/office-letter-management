from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import and_, func, or_, select, true
from sqlalchemy.orm import Session, selectinload

from app.models.activity import AuditLog, LoginLog
from app.models.letter import Letter, LetterAssignment, LetterStatus
from app.models.user import User
from app.rbac.roles import Roles, has_role_name, is_system_admin
from app.services.letter_list_order import apply_letters_newest_activity_order


def _is_admin(user: User) -> bool:
    return is_system_admin(user)


def _is_receiving_officer(user: User) -> bool:
    return has_role_name(user, Roles.RECEIVING_OFFICER)


def _is_approval_head(user: User) -> bool:
    return has_role_name(user, Roles.APPROVAL_HEAD_PEC)


@dataclass
class ReportFilters:
    date_from: date | None
    date_to: date | None
    department_id: int | None
    status: LetterStatus | None
    q: str | None = None
    from_office: str | None = None


class ReportsService:
    def __init__(self, db: Session):
        self.db = db

    def _validate_department_scope(self, user: User, requested: int | None) -> None:
        if _is_admin(user):
            return
        if _is_receiving_officer(user) or _is_approval_head(user):
            return
        if (
            requested is not None
            and user.department_id is not None
            and requested != user.department_id
        ):
            raise ValueError("You may only view reports for your department")

    def _effective_department_id(self, user: User, requested: int | None) -> int | None:
        if _is_admin(user):
            return requested
        if _is_receiving_officer(user) or _is_approval_head(user):
            return requested
        return user.department_id

    def _letter_conditions(self, user: User, filters: ReportFilters) -> list:
        self._validate_department_scope(user, filters.department_id)
        conds: list = []
        eff = self._effective_department_id(user, filters.department_id)
        if eff is not None:
            if _is_admin(user) or _is_receiving_officer(user) or _is_approval_head(user):
                conds.append(Letter.department_id == eff)
            else:
                assignee_any = Letter.id.in_(
                    select(LetterAssignment.letter_id).where(LetterAssignment.consultant_id == user.id)
                )
                conds.append(or_(Letter.department_id == eff, assignee_any))
        elif not _is_admin(user) and not _is_receiving_officer(user) and not _is_approval_head(user):
            conds.append(Letter.id == -1)
        if filters.date_from is not None:
            start = datetime(
                filters.date_from.year,
                filters.date_from.month,
                filters.date_from.day,
                tzinfo=timezone.utc,
            )
            conds.append(Letter.created_at >= start)
        if filters.date_to is not None:
            end = datetime(
                filters.date_to.year,
                filters.date_to.month,
                filters.date_to.day,
                23,
                59,
                59,
                999999,
                tzinfo=timezone.utc,
            )
            conds.append(Letter.created_at <= end)
        if filters.status is not None:
            conds.append(Letter.status == filters.status)
        if filters.q:
            qv = f"%{filters.q.strip()}%"
            conds.append(
                (Letter.serial_no.ilike(qv))
                | (Letter.memo_no.ilike(qv))
                | (Letter.subject.ilike(qv))
            )
        if filters.from_office:
            conds.append(Letter.received_from.ilike(f"%{filters.from_office.strip()}%"))
        return conds

    def _where(self, conds: list):
        if not conds:
            return true()
        return and_(*conds)

    def get_analytics(self, user: User, filters: ReportFilters) -> dict:
        conds = self._letter_conditions(user, filters)
        wc = self._where(conds)

        total_letters = self.db.scalar(select(func.count(Letter.id)).where(wc)) or 0

        status_rows = self.db.execute(
            select(Letter.status, func.count(Letter.id)).where(wc).group_by(Letter.status)
        ).all()
        letters_by_status = {s.value: c for s, c in status_rows}
        pending_assignment = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    wc,
                    Letter.status == LetterStatus.RECEIVED,
                    Letter.department_id.is_(None),
                )
            )
            or 0
        )
        letters_by_status["pending_assignment"] = pending_assignment

        priority_rows = self.db.execute(
            select(Letter.priority, func.count(Letter.id)).where(wc).group_by(Letter.priority)
        ).all()
        letters_by_priority = {p.value: c for p, c in priority_rows}

        assign_rows = self.db.execute(
            select(LetterAssignment.work_status, func.count(LetterAssignment.id))
            .select_from(LetterAssignment)
            .join(Letter, Letter.id == LetterAssignment.letter_id)
            .where(wc)
            .group_by(LetterAssignment.work_status)
        ).all()
        assignments_by_work_status = {ws.value: c for ws, c in assign_rows}

        active_assignments = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc, LetterAssignment.is_active.is_(True))
            )
            or 0
        )

        closed_letters = (
            self.db.scalar(
                select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.CLOSED)
            )
            or 0
        )

        closed_models = list(
            self.db.scalars(
                select(Letter).where(wc, Letter.closed_at.isnot(None))
            ).all()
        )
        avg_days_to_close: float | None = None
        if closed_models:
            total_days = 0.0
            for letter in closed_models:
                ca = letter.closed_at
                cr = letter.created_at
                if ca is None:
                    continue
                total_days += (ca - cr).total_seconds() / 86400.0
            avg_days_to_close = round(total_days / len(closed_models), 2)

        audit_wc = []
        if filters.date_from is not None:
            audit_wc.append(
                AuditLog.created_at
                >= datetime(
                    filters.date_from.year,
                    filters.date_from.month,
                    filters.date_from.day,
                    tzinfo=timezone.utc,
                )
            )
        if filters.date_to is not None:
            audit_wc.append(
                AuditLog.created_at
                <= datetime(
                    filters.date_to.year,
                    filters.date_to.month,
                    filters.date_to.day,
                    23,
                    59,
                    59,
                    999999,
                    tzinfo=timezone.utc,
                )
            )
        audit_events = (
            self.db.scalar(select(func.count(AuditLog.id)).where(self._where(audit_wc)))
            if audit_wc
            else self.db.scalar(select(func.count(AuditLog.id)))
            or 0
        )

        login_wc = []
        if filters.date_from is not None:
            login_wc.append(
                LoginLog.created_at
                >= datetime(
                    filters.date_from.year,
                    filters.date_from.month,
                    filters.date_from.day,
                    tzinfo=timezone.utc,
                )
            )
        if filters.date_to is not None:
            login_wc.append(
                LoginLog.created_at
                <= datetime(
                    filters.date_to.year,
                    filters.date_to.month,
                    filters.date_to.day,
                    23,
                    59,
                    59,
                    999999,
                    tzinfo=timezone.utc,
                )
            )
        lw = self._where(login_wc)
        logins_success = self.db.scalar(
            select(func.count(LoginLog.id)).where(lw, LoginLog.success.is_(True))
        ) or 0
        logins_failed = self.db.scalar(
            select(func.count(LoginLog.id)).where(lw, LoginLog.success.is_(False))
        ) or 0

        period: dict[str, str | None] = {
            "date_from": filters.date_from.isoformat() if filters.date_from else None,
            "date_to": filters.date_to.isoformat() if filters.date_to else None,
        }

        return {
            "period": period,
            "total_letters": total_letters,
            "letters_by_status": letters_by_status,
            "letters_by_priority": letters_by_priority,
            "active_assignments": active_assignments,
            "assignments_by_work_status": assignments_by_work_status,
            "closed_letters": closed_letters,
            "avg_days_to_close": avg_days_to_close,
            "audit_events": audit_events,
            "logins_success": logins_success,
            "logins_failed": logins_failed,
        }

    def list_letters_for_export(self, user: User, filters: ReportFilters, *, limit: int = 5000) -> list:
        conds = self._letter_conditions(user, filters)
        wc = self._where(conds)
        base = select(Letter).options(selectinload(Letter.department)).where(wc)
        return list(self.db.scalars(apply_letters_newest_activity_order(base).limit(limit)).all())
