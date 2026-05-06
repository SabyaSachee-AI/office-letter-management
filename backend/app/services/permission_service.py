from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.role_screen_permission import RoleScreenPermission
from app.models.user import User
from app.rbac.roles import is_system_admin
from app.rbac.screens import ALL_SCREEN_KEYS, default_screen_matrix, expand_legacy_letters


class PermissionService:
    def __init__(self, db: Session):
        self.db = db

    def _matrix_keys_for_role_name(self, role_name: str) -> frozenset[str]:
        matrix = default_screen_matrix()
        if role_name in matrix:
            return matrix[role_name]
        if role_name == "Admin":
            return matrix.get("System Admin", frozenset())
        if role_name == "Approval Head":
            return matrix.get("Approval Head-PEC", frozenset())
        return frozenset()

    def _legacy_allowed_screens(self, user: User) -> set[str]:
        keys: set[str] = set()
        for role in user.roles:
            keys.update(self._matrix_keys_for_role_name(role.name))
        return keys

    def _legacy_can_access(self, user: User, screen_key: str) -> bool:
        return screen_key in self._legacy_allowed_screens(user)

    def _db_granted_screens_for_roles(self, role_ids: list[int]) -> set[str]:
        rows = self.db.scalars(
            select(RoleScreenPermission.screen_key).where(
                RoleScreenPermission.role_id.in_(role_ids)
            )
        ).all()
        return expand_legacy_letters(set(rows))

    def user_can_access_screen(self, user: User, screen_key: str) -> bool:
        if is_system_admin(user):
            return True
        role_ids = [r.id for r in user.roles]
        if not role_ids:
            return False

        perm_count = self.db.scalar(
            select(func.count())
            .select_from(RoleScreenPermission)
            .where(RoleScreenPermission.role_id.in_(role_ids))
        ) or 0

        if perm_count > 0:
            granted = self._db_granted_screens_for_roles(role_ids)
            return screen_key in granted
        return self._legacy_can_access(user, screen_key)

    def allowed_screens_for_user(self, user: User) -> list[str]:
        if is_system_admin(user):
            return list(ALL_SCREEN_KEYS)
        role_ids = [r.id for r in user.roles]
        if not role_ids:
            return []
        perm_count = self.db.scalar(
            select(func.count())
            .select_from(RoleScreenPermission)
            .where(RoleScreenPermission.role_id.in_(role_ids))
        ) or 0
        if perm_count > 0:
            return sorted(self._db_granted_screens_for_roles(role_ids))
        return sorted(self._legacy_allowed_screens(user))

    def get_matrix(self) -> dict[int, set[str]]:
        rows = self.db.scalars(select(RoleScreenPermission)).all()
        out: dict[int, set[str]] = {}
        for r in rows:
            out.setdefault(r.role_id, set()).add(r.screen_key)
        return out

    def set_role_screens(self, role_id: int, screen_keys: set[str]) -> None:
        self.db.execute(
            delete(RoleScreenPermission).where(RoleScreenPermission.role_id == role_id)
        )
        for key in screen_keys:
            self.db.add(RoleScreenPermission(role_id=role_id, screen_key=key))

    def reset_all_to_defaults(self) -> None:
        self.db.execute(delete(RoleScreenPermission))
        matrix = default_screen_matrix()
        roles = self.db.scalars(select(Role)).all()
        name_to_role = {r.name: r for r in roles}
        for canonical, keys in matrix.items():
            role = name_to_role.get(canonical)
            if role is None and canonical == "System Admin":
                role = name_to_role.get("Admin")
            if role is None and canonical == "Approval Head-PEC":
                role = name_to_role.get("Approval Head")
            if role is None:
                continue
            for key in keys:
                self.db.add(RoleScreenPermission(role_id=role.id, screen_key=key))
