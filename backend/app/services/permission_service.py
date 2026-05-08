from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.role_screen_permission import RoleScreenPermission
from app.models.user import User
from app.rbac.permissions import (
    LEGACY_SCREEN_TO_VIEW_PERMISSION,
    all_known_permission_keys,
    expand_legacy_letters,
    expand_permission_keys,
)
from app.rbac.roles import is_system_admin
from app.rbac.screens import default_screen_matrix

# Stored when an admin saves a role with no permissions selected (distinct from "never saved").
MATRIX_ROLE_EMPTY_MARKER: str = "__matrix_role_empty__"


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

    def effective_permission_keys(self, user: User) -> frozenset[str]:
        """Resolve grants per role: stored keys only, explicit empty, or built-in defaults.

        - If the role has DB rows and one is ``MATRIX_ROLE_EMPTY_MARKER``, that role grants nothing.
        - If the role has any other DB rows, only those apply (so removals below defaults work).
        - If the role has no DB rows, use the built-in default matrix (stray/partial DB data must not
          zero out roles that were never written to the matrix).
        """
        if is_system_admin(user):
            return all_known_permission_keys()
        if not user.roles:
            return frozenset()

        combined: set[str] = set()
        for role in user.roles:
            if not getattr(role, "is_active", True):
                continue
            rows = list(
                self.db.scalars(
                    select(RoleScreenPermission.screen_key).where(
                        RoleScreenPermission.role_id == role.id
                    )
                ).all()
            )
            row_set = set(rows)
            if MATRIX_ROLE_EMPTY_MARKER in row_set:
                continue
            if row_set:
                combined.update(row_set - {MATRIX_ROLE_EMPTY_MARKER})
            else:
                combined.update(self._matrix_keys_for_role_name(role.name))

        return frozenset(expand_permission_keys(combined))

    def user_has_permission(self, user: User, permission_key: str) -> bool:
        if is_system_admin(user):
            return True
        return permission_key in self.effective_permission_keys(user)

    def user_can_access_screen(self, user: User, screen_key: str) -> bool:
        """Route / menu access: legacy module key or matching ``*:view`` permission."""
        if is_system_admin(user):
            return True
        eff = self.effective_permission_keys(user)
        if screen_key in eff:
            return True
        view_perm = LEGACY_SCREEN_TO_VIEW_PERMISSION.get(screen_key)
        return view_perm is not None and view_perm in eff

    def allowed_screens_for_user(self, user: User) -> list[str]:
        """Returned to clients for sidebar, route guards, and action checks."""
        return sorted(self.effective_permission_keys(user))

    def get_matrix(self) -> dict[int, set[str]]:
        """Every role id maps to a set (possibly empty) of stored screen_key strings."""
        role_ids = list(self.db.scalars(select(Role.id)).all())
        out: dict[int, set[str]] = {rid: set() for rid in role_ids}
        for row in self.db.scalars(select(RoleScreenPermission)).all():
            if row.role_id in out:
                out[row.role_id].add(row.screen_key)
        return out

    def set_role_screens(self, role_id: int, screen_keys: set[str]) -> None:
        self.db.execute(delete(RoleScreenPermission).where(RoleScreenPermission.role_id == role_id))
        cleaned = {str(k).strip() for k in screen_keys if k is not None and str(k).strip()}
        normalized = expand_legacy_letters(cleaned)
        if not normalized:
            self.db.add(
                RoleScreenPermission(role_id=role_id, screen_key=MATRIX_ROLE_EMPTY_MARKER)
            )
            return
        for key in normalized:
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
