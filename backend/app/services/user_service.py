import logging

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_password_hash
from app.models.department import Department
from app.models.role import Role
from app.models.user import User, user_roles
from app.models.user import UserStatus
from app.rbac.roles import Roles, expand_role_names, has_role_name
from app.schemas.user import UserCreate, UserFilterParams, UserUpdate

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def _get_roles(self, role_ids: list[int]) -> list[Role]:
        if not role_ids:
            return []
        roles = list(self.db.scalars(select(Role).where(Role.id.in_(role_ids))).all())
        if len(roles) != len(set(role_ids)):
            raise ValueError("Some roles were not found")
        return roles

    def _get_department(self, department_id: int | None) -> Department | None:
        if department_id is None:
            return None
        department = self.db.get(Department, department_id)
        if department is None:
            raise ValueError("Department not found")
        return department

    def _user_has_consultant_role(self, roles: list[Role]) -> bool:
        names = {r.name for r in roles}
        return bool(names & expand_role_names(Roles.CONSULTANT))

    def _validate_consultant_reporting_leader(
        self,
        *,
        department_id: int | None,
        consultant_type: str | None,
        reporting_team_leader_id: int | None,
        roles: list[Role],
    ) -> None:
        if not self._user_has_consultant_role(roles):
            return
        ct = (consultant_type or "").strip()
        if not ct:
            raise ValueError("Consultant type is required for Consultant role")
        if reporting_team_leader_id is None:
            raise ValueError("Reporting team leader is required for Consultant role")
        tl = self.db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == reporting_team_leader_id)
        )
        if tl is None:
            raise ValueError("Reporting team leader not found")
        if tl.status != UserStatus.ACTIVE:
            raise ValueError("Reporting team leader must be active")
        if not has_role_name(tl, Roles.TEAM_LEADER):
            raise ValueError("Reporting team leader must have the Team Leader role")
        if department_id is not None and tl.department_id != department_id:
            raise ValueError(
                "Reporting team leader must belong to the same department as the consultant"
            )

    def create_user(self, payload: UserCreate) -> User:
        existing = self.db.scalar(select(User).where(User.email == payload.email))
        if existing:
            raise ValueError("Email already exists")
        uname = payload.username.strip()
        if self.db.scalar(select(User).where(User.username == uname)):
            raise ValueError("Username already exists")

        user = User(
            email=payload.email,
            username=uname,
            full_name=payload.full_name,
            employee_id=payload.employee_id.strip() if payload.employee_id else None,
            nid=payload.nid.strip(),
            phone_number=payload.phone_number.strip(),
            designation=payload.designation.strip() if payload.designation else None,
            password_hash=get_password_hash(payload.password),
            status=payload.status,
            department_id=payload.department_id,
            approval_department_id=payload.approval_department_id,
            team_department_id=payload.team_department_id,
            receiving_department_id=payload.receiving_department_id,
            consultant_type=payload.consultant_type.strip() if payload.consultant_type else None,
            reporting_team_leader_id=payload.reporting_team_leader_id,
        )
        self._get_department(payload.department_id)
        if payload.approval_department_id is not None:
            self._get_department(payload.approval_department_id)
        if payload.team_department_id is not None:
            self._get_department(payload.team_department_id)
        if payload.receiving_department_id is not None:
            self._get_department(payload.receiving_department_id)

        user.roles = self._get_roles(payload.role_ids)
        if not self._user_has_consultant_role(user.roles):
            user.consultant_type = None
            user.reporting_team_leader_id = None
        else:
            self._validate_consultant_reporting_leader(
                department_id=payload.department_id,
                consultant_type=user.consultant_type,
                reporting_team_leader_id=user.reporting_team_leader_id,
                roles=user.roles,
            )

        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            logger.warning("create_user integrity error: %s", exc)
            raise ValueError("Email or username already exists") from exc
        self.db.refresh(user)
        return self.get_user(user.id)

    def update_user(self, user_id: int, payload: UserUpdate) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise ValueError("User not found")

        update_data = payload.model_dump(exclude_unset=True)

        if "email" in update_data:
            email = update_data["email"]
            other = self.db.scalar(select(User).where(User.email == email, User.id != user_id))
            if other:
                raise ValueError("Email already exists")
            user.email = email
        if "username" in update_data and update_data["username"] is not None:
            uname = update_data["username"].strip()
            other = self.db.scalar(
                select(User).where(User.username == uname, User.id != user_id)
            )
            if other:
                raise ValueError("Username already exists")
            user.username = uname
        if "full_name" in update_data:
            user.full_name = update_data["full_name"]
        if "password" in update_data:
            user.password_hash = get_password_hash(update_data["password"])
        if "status" in update_data:
            user.status = update_data["status"]
        if "nid" in update_data:
            user.nid = update_data["nid"].strip() if update_data["nid"] else None
        if "phone_number" in update_data:
            user.phone_number = (
                update_data["phone_number"].strip() if update_data["phone_number"] else None
            )
        if "employee_id" in update_data:
            user.employee_id = (
                update_data["employee_id"].strip() if update_data["employee_id"] else None
            )
        if "designation" in update_data:
            user.designation = (
                update_data["designation"].strip() if update_data["designation"] else None
            )
        if "role_ids" in update_data:
            user.roles = self._get_roles(update_data["role_ids"])
        if "department_id" in update_data:
            department_id = update_data["department_id"]
            if department_id is not None:
                self._get_department(department_id)
            user.department_id = department_id
        for wf_key in (
            "approval_department_id",
            "team_department_id",
            "receiving_department_id",
        ):
            if wf_key in update_data:
                did = update_data[wf_key]
                if did is not None:
                    self._get_department(did)
                setattr(user, wf_key, did)
        if "consultant_type" in update_data:
            v = update_data["consultant_type"]
            user.consultant_type = v.strip() if v else None
        if "reporting_team_leader_id" in update_data:
            user.reporting_team_leader_id = update_data["reporting_team_leader_id"]

        roles_list = list(user.roles)
        if not self._user_has_consultant_role(roles_list):
            user.consultant_type = None
            user.reporting_team_leader_id = None
        else:
            self._validate_consultant_reporting_leader(
                department_id=user.department_id,
                consultant_type=user.consultant_type,
                reporting_team_leader_id=user.reporting_team_leader_id,
                roles=roles_list,
            )

        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            logger.warning("update_user integrity error: %s", exc)
            raise ValueError("Email or username already exists") from exc
        self.db.refresh(user)
        return self.get_user(user.id)

    def delete_user(self, user_id: int) -> None:
        user = self.db.get(User, user_id)
        if user is None:
            raise ValueError("User not found")
        self.db.delete(user)
        self.db.commit()

    def get_user(self, user_id: int) -> User:
        user = self.db.scalar(
            select(User)
            .options(
                selectinload(User.roles),
                selectinload(User.department),
                selectinload(User.approval_department),
                selectinload(User.team_department),
                selectinload(User.receiving_department),
            )
            .where(User.id == user_id)
        )
        if user is None:
            raise ValueError("User not found")
        return user

    def list_users(self, params: UserFilterParams) -> tuple[list[User], int]:
        stmt = select(User).options(
            selectinload(User.roles),
            selectinload(User.department),
            selectinload(User.approval_department),
            selectinload(User.team_department),
            selectinload(User.receiving_department),
        )
        count_stmt = select(func.count(User.id))

        filters = []
        if params.q:
            q = f"%{params.q.strip()}%"
            filters.append(
                or_(
                    User.full_name.ilike(q),
                    User.email.ilike(q),
                    User.username.ilike(q),
                    User.employee_id.ilike(q),
                )
            )
        if params.department_id is not None:
            filters.append(User.department_id == params.department_id)
        if params.status is not None:
            filters.append(User.status == params.status)
        if params.role_id is not None:
            stmt = stmt.join(User.roles)
            count_stmt = count_stmt.join(User.roles)
            filters.append(Role.id == params.role_id)

        if filters:
            stmt = stmt.where(*filters)
            count_stmt = count_stmt.where(*filters)

        if params.role_id is not None:
            stmt = stmt.distinct(User.id)
            count_stmt = count_stmt.with_only_columns(func.count(func.distinct(User.id)))

        total = self.db.scalar(count_stmt) or 0
        users = list(
            self.db.scalars(
                stmt.order_by(User.id.desc()).offset(params.offset).limit(params.limit)
            ).all()
        )
        return users, total

    def list_consultants_for_assignment(
        self,
        *,
        department_id: int,
        q: str | None,
        limit: int,
    ) -> list[User]:
        role_names = expand_role_names(Roles.CONSULTANT)
        stmt = (
            select(User)
            .join(user_roles, User.id == user_roles.c.user_id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(Role.name.in_(role_names))
            .where(User.department_id == department_id)
            .where(User.status == UserStatus.ACTIVE)
            .options(selectinload(User.roles), selectinload(User.department))
            .distinct()
            .limit(limit)
        )
        if q:
            qq = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(User.full_name.ilike(qq), User.email.ilike(qq), User.username.ilike(qq))
            )
        return list(self.db.scalars(stmt).all())

    def list_team_leaders_for_consultant_form(
        self,
        *,
        department_id: int | None,
        limit: int = 200,
    ) -> list[User]:
        role_names = expand_role_names(Roles.TEAM_LEADER)
        stmt = (
            select(User)
            .join(user_roles, User.id == user_roles.c.user_id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(Role.name.in_(role_names))
            .where(User.status == UserStatus.ACTIVE)
            .options(selectinload(User.roles), selectinload(User.department))
            .distinct()
        )
        if department_id is not None:
            stmt = stmt.where(User.department_id == department_id)
        stmt = stmt.order_by(User.full_name.asc()).limit(limit)
        return list(self.db.scalars(stmt).all())
