from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.rbac.permissions import PermissionKey as PK
from app.rbac.roles import Roles, expand_role_names, is_system_admin, user_role_names
from app.services.permission_service import PermissionService

_CONSULTANT_PERMISSION_KEYS: tuple[str, ...] = (
    PK.CONSULTANT_VIEW,
    PK.CONSULTANT_UPDATE,
    PK.CONSULTANT_RESOLVE,
    PK.CONSULTANT_TRANSFER,
    PK.CONSULTANT_UPLOAD,
)


def require_roles(*allowed_roles: str) -> Callable[[Annotated[User, Depends(get_current_user)]], User]:
    expanded = expand_role_names(*allowed_roles)

    def _guard(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        user_role_names = {role.name for role in current_user.roles}
        if not user_role_names.intersection(expanded):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return _guard


def require_consultant_workspace_actor():
    """Consultant workspace: Consultant role, System Admin, or any ``consultant:*`` permission (matrix)."""

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if is_system_admin(current_user):
            return current_user
        if user_role_names(current_user) & expand_role_names(Roles.CONSULTANT):
            return current_user
        svc = PermissionService(db)
        if any(svc.user_has_permission(current_user, k) for k in _CONSULTANT_PERMISSION_KEYS):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return _guard


def require_letter_list_actor():
    """GET /letters list: workflow roles (incl. Consultant), Admin, or ``letters:view`` / ``closure:view``.

    Closure queue UIs call this endpoint with ``closure:*`` grants without requiring full Letters Browse.
    """

    _keys = (PK.LETTERS_VIEW, PK.CLOSURE_VIEW)
    _roles = expand_role_names(
        Roles.ADMIN,
        Roles.RECEIVING_OFFICER,
        Roles.APPROVAL_HEAD,
        Roles.TEAM_LEADER,
        Roles.CONSULTANT,
    )

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if is_system_admin(current_user):
            return current_user
        if user_role_names(current_user) & _roles:
            return current_user
        svc = PermissionService(db)
        if any(svc.user_has_permission(current_user, k) for k in _keys):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this resource. Contact an administrator if you need a role or screen permission updated.",
        )

    return _guard


def require_closure_review_actor():
    """POST review / final remark: System Admin, Team Leader, or ``closure:review`` (matrix)."""

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if is_system_admin(current_user):
            return current_user
        if user_role_names(current_user) & expand_role_names(Roles.TEAM_LEADER):
            return current_user
        svc = PermissionService(db)
        if svc.user_has_permission(current_user, PK.CLOSURE_REVIEW):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return _guard


def require_closure_close_actor():
    """POST close letter: System Admin, Team Leader, or ``closure:close`` (matrix)."""

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if is_system_admin(current_user):
            return current_user
        if user_role_names(current_user) & expand_role_names(Roles.TEAM_LEADER):
            return current_user
        svc = PermissionService(db)
        if svc.user_has_permission(current_user, PK.CLOSURE_CLOSE):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return _guard


def require_screen(screen_key: str):
    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if not PermissionService(db).user_can_access_screen(current_user, screen_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource. Contact an administrator if you need a role or screen permission updated.",
            )
        return current_user

    return _guard


def require_any_screen(*screen_keys: str):
    keys = tuple(screen_keys)

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        svc = PermissionService(db)
        if any(svc.user_can_access_screen(current_user, k) for k in keys):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this resource. Contact an administrator if you need a role or screen permission updated.",
        )

    return _guard


def require_permission(*permission_keys: str):
    """Require at least one granular permission (legacy module grants expand server-side)."""

    keys = tuple(permission_keys)

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        svc = PermissionService(db)
        if any(svc.user_has_permission(current_user, k) for k in keys):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return _guard


def require_any_permission(*permission_keys: str):
    keys = tuple(permission_keys)

    def _guard(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        svc = PermissionService(db)
        if any(svc.user_has_permission(current_user, k) for k in keys):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    return _guard
