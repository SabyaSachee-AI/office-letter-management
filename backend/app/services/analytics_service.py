from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, case, func, or_, select, true
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.letter import AssignmentWorkStatus, Letter, LetterAssignment, LetterStatus
from app.models.role import Role
from app.models.user import User, UserStatus
from app.rbac.roles import Roles, has_role_name, is_system_admin
from app.schemas.analytics import (
    AnalyticsOverviewOut,
    AnalyticsScopeOut,
    BottleneckItemOut,
    BottleneckOut,
    ConsultantAnalyticsItemOut,
    ConsultantAnalyticsOut,
    ConsultantTrendPointOut,
    DepartmentAnalyticsItemOut,
    DepartmentAnalyticsOut,
    DepartmentTrendPointOut,
    SummaryCardsOut,
    TrendPointOut,
    TrendsOut,
    WorkflowStatusItemOut,
    WorkflowStatusOut,
)


@dataclass
class AnalyticsFilters:
    date_from: date | None = None
    date_to: date | None = None
    preset: str | None = None
    department_id: int | None = None


@dataclass
class TablePaging:
    """When limit is None, all matching rows are returned (CSV, bottlenecks, internal use)."""

    limit: int | None = None
    offset: int = 0
    sort_by: str = "total_letters"
    sort_dir: str = "desc"


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def _role_scope(self, user: User) -> AnalyticsScopeOut:
        if is_system_admin(user):
            return AnalyticsScopeOut(role_view="system_admin", department_id=None, user_id=user.id)
        if has_role_name(user, Roles.APPROVAL_HEAD_PEC):
            return AnalyticsScopeOut(role_view="approval_head", department_id=None, user_id=user.id)
        if has_role_name(user, Roles.TEAM_LEADER):
            return AnalyticsScopeOut(
                role_view="team_leader",
                department_id=user.team_department_id or user.department_id,
                user_id=user.id,
            )
        if has_role_name(user, Roles.CONSULTANT):
            return AnalyticsScopeOut(role_view="consultant", department_id=user.department_id, user_id=user.id)
        if has_role_name(user, Roles.RECEIVING_OFFICER):
            return AnalyticsScopeOut(
                role_view="receiving_officer",
                department_id=user.receiving_department_id or user.department_id,
                user_id=user.id,
            )
        raise ValueError("Insufficient role for analytics")

    def _time_window(self, filters: AnalyticsFilters) -> tuple[datetime | None, datetime | None]:
        if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        if filters.date_from or filters.date_to:
            start = (
                datetime(filters.date_from.year, filters.date_from.month, filters.date_from.day, tzinfo=timezone.utc)
                if filters.date_from
                else None
            )
            end = (
                datetime(
                    filters.date_to.year,
                    filters.date_to.month,
                    filters.date_to.day,
                    23,
                    59,
                    59,
                    999999,
                    tzinfo=timezone.utc,
                )
                if filters.date_to
                else None
            )
            return start, end

        now = datetime.now(timezone.utc)
        preset = (filters.preset or "30d").lower()
        if preset in ("today",):
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif preset in ("7d", "7days"):
            start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)
        elif preset in ("30d", "30days"):
            start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
        elif preset in ("monthly",):
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif preset in ("yearly",):
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
        return start, now

    def _letter_scope_conditions(self, user: User, scope: AnalyticsScopeOut, filters: AnalyticsFilters) -> list:
        conds: list = []
        start, end = self._time_window(filters)
        if start is not None:
            conds.append(Letter.created_at >= start)
        if end is not None:
            conds.append(Letter.created_at <= end)
        if filters.department_id is not None:
            if scope.role_view not in ("system_admin", "approval_head") and filters.department_id != scope.department_id:
                raise ValueError("Not allowed to view another department")
            conds.append(Letter.department_id == filters.department_id)
        elif scope.role_view == "team_leader" and scope.department_id is not None:
            conds.append(
                or_(
                    Letter.department_id == scope.department_id,
                    Letter.id.in_(
                        select(LetterAssignment.letter_id).where(LetterAssignment.consultant_id == user.id)
                    ),
                )
            )
        elif scope.role_view == "consultant":
            conds.append(
                Letter.id.in_(
                    select(LetterAssignment.letter_id).where(LetterAssignment.consultant_id == user.id)
                )
            )
        elif scope.role_view == "receiving_officer":
            conds.append(or_(Letter.created_by == user.id, Letter.department_id == scope.department_id))
        return conds

    @staticmethod
    def _where(conds: list):
        return and_(*conds) if conds else true()

    @staticmethod
    def _month_key(dt: datetime | None) -> str | None:
        if dt is None:
            return None
        return dt.strftime("%Y-%m")

    def _summary_cards(self, wc) -> SummaryCardsOut:
        total = self.db.scalar(select(func.count(Letter.id)).where(wc)) or 0
        pending_approval = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    wc,
                    Letter.status == LetterStatus.RECEIVED,
                )
            )
            or 0
        )
        under_department_processing = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    wc,
                    Letter.status.in_([LetterStatus.PROCESSED, LetterStatus.UNDER_REVIEW]),
                )
            )
            or 0
        )
        consultant_active = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(
                    wc,
                    LetterAssignment.is_active.is_(True),
                    LetterAssignment.work_status.in_(
                        [AssignmentWorkStatus.ASSIGNED, AssignmentWorkStatus.IN_PROGRESS]
                    ),
                )
            )
            or 0
        )
        waiting_final = (
            self.db.scalar(
                select(func.count(Letter.id))
                .where(
                    wc,
                    Letter.status != LetterStatus.CLOSED,
                    Letter.id.in_(
                        select(LetterAssignment.letter_id).where(
                            LetterAssignment.work_status == AssignmentWorkStatus.RESOLVED
                        )
                    ),
                )
            )
            or 0
        )
        closed = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.CLOSED)) or 0
        rejected = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.REJECTED)) or 0
        returned = (
            self.db.scalar(
                select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.RETURNED_FOR_CORRECTION)
            )
            or 0
        )
        return SummaryCardsOut(
            total_letters=total,
            pending_approval=pending_approval,
            under_department_processing=under_department_processing,
            consultant_active_tasks=consultant_active,
            waiting_final_closure=waiting_final,
            officially_closed=closed,
            rejected_letters=rejected,
            returned_for_correction=returned,
        )

    def get_overview(self, user: User, filters: AnalyticsFilters) -> AnalyticsOverviewOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        summary = self._summary_cards(wc)
        workflow = self.get_workflow_status(user, filters)
        bottlenecks = self.get_bottlenecks(user, filters)
        return AnalyticsOverviewOut(scope=scope, summary=summary, workflow_status=workflow, bottlenecks=bottlenecks)

    _DEPT_SORT = frozenset(
        {
            "total_letters",
            "pending_count",
            "closed_count",
            "overdue_assignments",
            "department_name",
            "department_code",
            "avg_resolution_days",
        }
    )

    @staticmethod
    def _normalize_paging(paging: TablePaging | None) -> tuple[int | None, int, str, str]:
        if paging is None:
            return None, 0, "total_letters", "desc"
        lim = paging.limit
        if lim is not None:
            lim = max(1, min(int(lim), 200))
        off = max(0, int(paging.offset))
        sd = (paging.sort_dir or "desc").lower()
        if sd not in ("asc", "desc"):
            sd = "desc"
        sb = paging.sort_by or "total_letters"
        return lim, off, sb, sd

    def _department_agg_select(self, wc, now: datetime):
        overdue_expr = (
            select(func.count(LetterAssignment.id))
            .select_from(LetterAssignment)
            .join(Letter, Letter.id == LetterAssignment.letter_id)
            .where(
                wc,
                Letter.department_id == Department.id,
                LetterAssignment.is_active.is_(True),
                LetterAssignment.work_status.in_(
                    [AssignmentWorkStatus.ASSIGNED, AssignmentWorkStatus.IN_PROGRESS]
                ),
                LetterAssignment.deadline_at < now,
            )
        ).scalar_subquery()
        total_letters = func.count(Letter.id).label("total_letters")
        closed_count = func.sum(case((Letter.status == LetterStatus.CLOSED, 1), else_=0)).label("closed_count")
        pending_count = func.sum(case((Letter.status != LetterStatus.CLOSED, 1), else_=0)).label("pending_count")
        overdue_assignments = overdue_expr.label("overdue_assignments")
        return (
            select(
                Department.id,
                Department.name,
                Department.code,
                total_letters,
                closed_count,
                pending_count,
                overdue_assignments,
            )
            .select_from(Department)
            .join(Letter, Letter.department_id == Department.id, isouter=True)
            .where(wc)
            .group_by(Department.id, Department.name, Department.code)
        ), total_letters, closed_count, pending_count, overdue_assignments

    def _department_order_clause(self, sort_by: str, sort_dir: str, total_letters, pending_count, closed_count, overdue_assignments):
        key = sort_by if sort_by in self._DEPT_SORT else "total_letters"
        if key == "avg_resolution_days":
            key = "total_letters"
        col_map = {
            "total_letters": total_letters,
            "pending_count": pending_count,
            "closed_count": closed_count,
            "overdue_assignments": overdue_assignments,
            "department_name": Department.name,
            "department_code": Department.code,
        }
        col = col_map[key]
        return col.desc() if sort_dir == "desc" else col.asc()

    def get_departments(self, user: User, filters: AnalyticsFilters, paging: TablePaging | None = None) -> DepartmentAnalyticsOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        now = datetime.now(timezone.utc)
        limit, offset, sort_by, sort_dir = self._normalize_paging(paging)
        base_stmt, total_letters, closed_count, pending_count, overdue_assignments = self._department_agg_select(wc, now)
        order_clause = self._department_order_clause(sort_by, sort_dir, total_letters, closed_count, pending_count, overdue_assignments)
        stmt = base_stmt.order_by(order_clause)
        if limit is not None:
            total = self.db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
            stmt = stmt.offset(offset).limit(limit)
        else:
            total = None
        rows = self.db.execute(stmt).all()
        items: list[DepartmentAnalyticsItemOut] = []
        for dep_id, name, code, total, closed, pending, overdue in rows:
            closed_rows = list(
                self.db.execute(
                    select(Letter.created_at, Letter.closed_at).where(
                        wc,
                        Letter.department_id == dep_id,
                        Letter.closed_at.is_not(None),
                    )
                ).all()
            )
            avg_days = None
            if closed_rows:
                total_days = 0.0
                for c_at, cl_at in closed_rows:
                    total_days += (cl_at - c_at).total_seconds() / 86400.0
                avg_days = round(total_days / len(closed_rows), 2)
            items.append(
                DepartmentAnalyticsItemOut(
                    department_id=dep_id,
                    department_name=name,
                    department_code=code,
                    total_letters=int(total or 0),
                    pending_count=int(pending or 0),
                    closed_count=int(closed or 0),
                    overdue_assignments=int(overdue or 0),
                    avg_resolution_days=avg_days,
                )
            )
        if limit is None:
            resolved_total = len(items)
            return DepartmentAnalyticsOut(items=items, total=resolved_total, limit=None, offset=0)
        return DepartmentAnalyticsOut(items=items, total=int(total), limit=limit, offset=offset)

    _CONS_SORT = frozenset(
        {
            "assigned_count",
            "resolved_count",
            "transferred_count",
            "active_workload",
            "overdue_tasks",
            "consultant_name",
            "consultant_email",
            "avg_completion_days",
        }
    )

    def _consultant_agg_select(self, user: User, scope: AnalyticsScopeOut, wc, now: datetime):
        assigned_count = func.count(LetterAssignment.id).label("assigned_count")
        resolved_count = func.sum(
            case((LetterAssignment.work_status == AssignmentWorkStatus.RESOLVED, 1), else_=0)
        ).label("resolved_count")
        transferred_count = func.sum(
            case((LetterAssignment.work_status == AssignmentWorkStatus.TRANSFERRED, 1), else_=0)
        ).label("transferred_count")
        active_workload = func.sum(
            case(
                (
                    and_(
                        LetterAssignment.is_active.is_(True),
                        LetterAssignment.work_status.in_(
                            [AssignmentWorkStatus.ASSIGNED, AssignmentWorkStatus.IN_PROGRESS]
                        ),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("active_workload")
        overdue_tasks = func.sum(
            case(
                (
                    and_(
                        LetterAssignment.is_active.is_(True),
                        LetterAssignment.work_status.in_(
                            [AssignmentWorkStatus.ASSIGNED, AssignmentWorkStatus.IN_PROGRESS]
                        ),
                        LetterAssignment.deadline_at < now,
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("overdue_tasks")
        stmt = (
            select(
                User.id,
                User.full_name,
                User.email,
                assigned_count,
                resolved_count,
                transferred_count,
                active_workload,
                overdue_tasks,
            )
            .select_from(User)
            .join(User.roles)
            .join(LetterAssignment, LetterAssignment.consultant_id == User.id, isouter=True)
            .join(Letter, Letter.id == LetterAssignment.letter_id, isouter=True)
            .where(Role.name == Roles.CONSULTANT, User.status == UserStatus.ACTIVE, wc)
        )
        if scope.role_view == "consultant":
            stmt = stmt.where(User.id == user.id)
        stmt = stmt.group_by(User.id, User.full_name, User.email)
        return (
            stmt,
            assigned_count,
            resolved_count,
            transferred_count,
            active_workload,
            overdue_tasks,
        )

    def _consultant_order_clause(
        self, sort_by: str, sort_dir: str, assigned_count, resolved_count, transferred_count, active_workload, overdue_tasks
    ):
        key = sort_by if sort_by in self._CONS_SORT else "assigned_count"
        if key == "avg_completion_days":
            key = "assigned_count"
        col_map = {
            "assigned_count": assigned_count,
            "resolved_count": resolved_count,
            "transferred_count": transferred_count,
            "active_workload": active_workload,
            "overdue_tasks": overdue_tasks,
            "consultant_name": User.full_name,
            "consultant_email": User.email,
        }
        col = col_map[key]
        return col.desc() if sort_dir == "desc" else col.asc()

    def _consultant_avg_completion_days(self, wc, rid: int) -> float | None:
        comp_rows = list(
            self.db.execute(
                select(LetterAssignment.assigned_at, Letter.closed_at)
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc, LetterAssignment.consultant_id == rid, Letter.closed_at.is_not(None))
            ).all()
        )
        if not comp_rows:
            return None
        total_days = 0.0
        for a_at, c_at in comp_rows:
            total_days += (c_at - a_at).total_seconds() / 86400.0
        return round(total_days / len(comp_rows), 2)

    def _consultant_row_to_item(
        self,
        wc,
        rid: int,
        name: str,
        email: str,
        assigned,
        resolved,
        transferred,
        active,
        overdue,
    ) -> ConsultantAnalyticsItemOut:
        avg_completion = self._consultant_avg_completion_days(wc, rid)
        return ConsultantAnalyticsItemOut(
            consultant_id=rid,
            consultant_name=name,
            consultant_email=str(email),
            assigned_count=int(assigned or 0),
            resolved_count=int(resolved or 0),
            transferred_count=int(transferred or 0),
            active_workload=int(active or 0),
            overdue_tasks=int(overdue or 0),
            avg_completion_days=avg_completion,
        )

    def get_consultants(self, user: User, filters: AnalyticsFilters, paging: TablePaging | None = None) -> ConsultantAnalyticsOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        now = datetime.now(timezone.utc)
        limit, offset, sort_by, sort_dir = self._normalize_paging(paging)
        base_stmt, assigned_count, resolved_count, transferred_count, active_workload, overdue_tasks = (
            self._consultant_agg_select(user, scope, wc, now)
        )
        order_clause = self._consultant_order_clause(
            sort_by, sort_dir, assigned_count, resolved_count, transferred_count, active_workload, overdue_tasks
        )
        stmt = base_stmt.order_by(order_clause)
        if limit is not None:
            total = self.db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
            stmt = stmt.offset(offset).limit(limit)
        else:
            total = None
        rows = self.db.execute(stmt).all()
        items = [
            self._consultant_row_to_item(wc, rid, name, email, assigned, resolved, transferred, active, overdue)
            for rid, name, email, assigned, resolved, transferred, active, overdue in rows
        ]
        if limit is None:
            top = sorted(items, key=lambda x: (x.resolved_count, -x.overdue_tasks), reverse=True)[:5]
            overloaded = sorted(
                [x for x in items if x.active_workload >= 5 or x.overdue_tasks > 0],
                key=lambda x: (x.active_workload, x.overdue_tasks),
                reverse=True,
            )[:5]
            return ConsultantAnalyticsOut(
                items=items,
                top_performers=top,
                overloaded_consultants=overloaded,
                total=len(items),
                limit=None,
                offset=0,
            )
        sub = base_stmt.subquery()
        cons_cols = (
            sub.c.id,
            sub.c.full_name,
            sub.c.email,
            sub.c.assigned_count,
            sub.c.resolved_count,
            sub.c.transferred_count,
            sub.c.active_workload,
            sub.c.overdue_tasks,
        )
        top_rows = list(
            self.db.execute(
                select(*cons_cols)
                .order_by(sub.c.resolved_count.desc(), sub.c.overdue_tasks.asc())
                .limit(5)
            ).all()
        )
        over_rows = list(
            self.db.execute(
                select(*cons_cols)
                .where(or_(sub.c.active_workload >= 5, sub.c.overdue_tasks > 0))
                .order_by(sub.c.active_workload.desc(), sub.c.overdue_tasks.desc())
                .limit(5)
            ).all()
        )

        top = [
            self._consultant_row_to_item(wc, *r)
            for r in top_rows
        ]
        overloaded = [
            self._consultant_row_to_item(wc, *r)
            for r in over_rows
        ]
        return ConsultantAnalyticsOut(
            items=items,
            top_performers=top,
            overloaded_consultants=overloaded,
            total=int(total),
            limit=limit,
            offset=offset,
        )

    def get_workflow_status(self, user: User, filters: AnalyticsFilters) -> WorkflowStatusOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        received = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.RECEIVED)) or 0
        forwarded = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.PROCESSED)) or 0
        assigned = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc, LetterAssignment.is_active.is_(True), LetterAssignment.work_status == AssignmentWorkStatus.ASSIGNED)
            )
            or 0
        )
        in_progress = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc, LetterAssignment.is_active.is_(True), LetterAssignment.work_status == AssignmentWorkStatus.IN_PROGRESS)
            )
            or 0
        )
        solution_submitted = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc, LetterAssignment.work_status == AssignmentWorkStatus.RESOLVED)
            )
            or 0
        )
        pending_final = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    wc,
                    Letter.status != LetterStatus.CLOSED,
                    Letter.id.in_(select(LetterAssignment.letter_id).where(LetterAssignment.work_status == AssignmentWorkStatus.RESOLVED)),
                )
            )
            or 0
        )
        closed = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.CLOSED)) or 0
        rejected = self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.REJECTED)) or 0
        returned = (
            self.db.scalar(select(func.count(Letter.id)).where(wc, Letter.status == LetterStatus.RETURNED_FOR_CORRECTION))
            or 0
        )
        items = [
            WorkflowStatusItemOut(key="pending_approval", label="Received & Pending Approval", count=int(received)),
            WorkflowStatusItemOut(key="forwarded_department", label="Forwarded to Department", count=int(forwarded)),
            WorkflowStatusItemOut(key="assigned_processing", label="Assigned for Processing", count=int(assigned)),
            WorkflowStatusItemOut(key="under_investigation", label="Under Investigation", count=int(in_progress)),
            WorkflowStatusItemOut(key="solution_submitted", label="Solution Submitted", count=int(solution_submitted)),
            WorkflowStatusItemOut(key="pending_closure", label="Pending Final Closure", count=int(pending_final)),
            WorkflowStatusItemOut(key="closed", label="Officially Closed", count=int(closed)),
            WorkflowStatusItemOut(key="rejected", label="Rejected", count=int(rejected)),
            WorkflowStatusItemOut(key="returned", label="Returned for Correction", count=int(returned)),
        ]
        return WorkflowStatusOut(items=items)

    def get_trends(self, user: User, filters: AnalyticsFilters) -> TrendsOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        recv_models = list(self.db.scalars(select(Letter).where(wc)).all())
        recv_map: dict[str, int] = {}
        close_map: dict[str, int] = {}
        for L in recv_models:
            mk = self._month_key(L.created_at)
            if mk:
                recv_map[mk] = recv_map.get(mk, 0) + 1
            ck = self._month_key(L.closed_at)
            if ck:
                close_map[ck] = close_map.get(ck, 0) + 1
        periods = sorted(set(recv_map.keys()) | set(close_map.keys()))
        letters = [TrendPointOut(period=p, received=recv_map.get(p, 0), closed=close_map.get(p, 0)) for p in periods]

        dep_points_map: dict[tuple[str, str], int] = {}
        dep_rows = list(
            self.db.execute(
                select(Letter.created_at, Department.code)
                .select_from(Letter)
                .join(Department, Department.id == Letter.department_id, isouter=True)
                .where(wc)
            ).all()
        )
        for c_at, code in dep_rows:
            mk = self._month_key(c_at) or "unknown"
            dc = code or "N/A"
            dep_points_map[(mk, dc)] = dep_points_map.get((mk, dc), 0) + 1
        dep_points = [
            DepartmentTrendPointOut(period=p, department_code=dc, letters=count)
            for (p, dc), count in sorted(dep_points_map.items())
        ]

        con_rows = list(
            self.db.execute(
                select(LetterAssignment.assigned_at, User.id, User.full_name)
                .select_from(LetterAssignment)
                .join(User, User.id == LetterAssignment.consultant_id)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(wc)
            ).all()
        )
        con_map: dict[tuple[str, int, str], int] = {}
        for a_at, cid, name in con_rows:
            if scope.role_view == "consultant" and cid != scope.user_id:
                continue
            mk = self._month_key(a_at) or "unknown"
            key = (mk, cid, name)
            con_map[key] = con_map.get(key, 0) + 1
        con_points = [
            ConsultantTrendPointOut(period=p, consultant_id=cid, consultant_name=name, assignments=count)
            for (p, cid, name), count in sorted(con_map.items())
        ]
        return TrendsOut(letters=letters, departments=dep_points, consultants=con_points)

    def get_bottlenecks(self, user: User, filters: AnalyticsFilters) -> BottleneckOut:
        scope = self._role_scope(user)
        conds = self._letter_scope_conditions(user, scope, filters)
        wc = self._where(conds)
        now = datetime.now(timezone.utc)
        overdue_assignments = (
            self.db.scalar(
                select(func.count(LetterAssignment.id))
                .select_from(LetterAssignment)
                .join(Letter, Letter.id == LetterAssignment.letter_id)
                .where(
                    wc,
                    LetterAssignment.is_active.is_(True),
                    LetterAssignment.work_status.in_([AssignmentWorkStatus.ASSIGNED, AssignmentWorkStatus.IN_PROGRESS]),
                    LetterAssignment.deadline_at < now,
                )
            )
            or 0
        )
        delayed_closures = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    wc,
                    Letter.status != LetterStatus.CLOSED,
                    Letter.created_at < now - timedelta(days=7),
                )
            )
            or 0
        )
        dep_items = self.get_departments(user, filters).items
        high_backlog = sorted(dep_items, key=lambda x: x.pending_count, reverse=True)[:5]
        pending_rows = list(
            self.db.execute(
                select(Letter.id, Letter.serial_no, Letter.subject, Department.code, Letter.created_at)
                .select_from(Letter)
                .join(Department, Department.id == Letter.department_id, isouter=True)
                .where(wc, Letter.status != LetterStatus.CLOSED)
            ).all()
        )
        pending_rows.sort(key=lambda r: r[4])
        longest: list[BottleneckItemOut] = []
        for i, sn, subj, dc, created_at in pending_rows[:10]:
            days = max(int((now - created_at).total_seconds() / 86400), 0)
            longest.append(
                BottleneckItemOut(
                    letter_id=i,
                    serial_no=sn,
                    subject=subj,
                    department_code=dc,
                    days_pending=days,
                )
            )
        return BottleneckOut(
            overdue_assignments=int(overdue_assignments),
            delayed_closures=int(delayed_closures),
            high_backlog_departments=high_backlog,
            longest_pending_letters=longest,
        )
