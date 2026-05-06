from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.rbac.roles import expand_role_names
from app.services.permission_service import PermissionService


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
