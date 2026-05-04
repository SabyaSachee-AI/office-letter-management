from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User


def require_roles(*allowed_roles: str) -> Callable[[Annotated[User, Depends(get_current_user)]], User]:
    def _guard(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        user_role_names = {role.name for role in current_user.roles}
        if not user_role_names.intersection(set(allowed_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _guard
