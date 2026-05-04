from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.user import UserStatus
from app.rbac.guards import require_roles
from app.rbac.roles import ALL_ROLES, Roles
from app.schemas.user import (
    DepartmentAssignment,
    RoleAssignment,
    StatusUpdate,
    UserCreate,
    UserFilterParams,
    UserListResponse,
    UserOut,
    UserUpdate,
)
from app.services.activity_service import ActivityService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

AdminOnly = Depends(require_roles(Roles.ADMIN))
AdminManager = Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[AdminOnly])
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> UserOut:
    service = UserService(db)
    try:
        user = service.create_user(payload)
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_created",
            resource_type="user",
            resource_id=user.id,
            detail={"email": user.email},
        )
        db.commit()
        return UserOut.model_validate(user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("", response_model=UserListResponse, dependencies=[AdminManager])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    role_id: int | None = Query(default=None),
    department_id: int | None = Query(default=None),
    status_filter: UserStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserListResponse:
    params = UserFilterParams(
        q=q,
        role_id=role_id,
        department_id=department_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )

    service = UserService(db)
    users, total = service.list_users(params)
    return UserListResponse(
        items=[UserOut.model_validate(user) for user in users],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


@router.put("/{user_id}", response_model=UserOut, dependencies=[AdminOnly])
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> UserOut:
    service = UserService(db)
    try:
        user = service.update_user(user_id, payload)
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_updated",
            resource_type="user",
            resource_id=user_id,
            detail={"fields": list(payload.model_dump(exclude_unset=True).keys())},
        )
        db.commit()
        return UserOut.model_validate(user)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[AdminOnly])
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> None:
    service = UserService(db)
    try:
        service.delete_user(user_id)
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_deleted",
            resource_type="user",
            resource_id=user_id,
            detail=None,
        )
        db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{user_id}/roles", response_model=UserOut, dependencies=[AdminOnly])
def assign_roles(
    user_id: int,
    payload: RoleAssignment,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> UserOut:
    service = UserService(db)
    try:
        user = service.update_user(user_id, UserUpdate(role_ids=payload.role_ids))
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_roles_updated",
            resource_type="user",
            resource_id=user_id,
            detail={"role_ids": payload.role_ids},
        )
        db.commit()
        return UserOut.model_validate(user)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.patch("/{user_id}/department", response_model=UserOut, dependencies=[AdminOnly])
def assign_department(
    user_id: int,
    payload: DepartmentAssignment,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> UserOut:
    service = UserService(db)
    try:
        user = service.update_user(user_id, UserUpdate(department_id=payload.department_id))
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_department_assigned",
            resource_type="user",
            resource_id=user_id,
            detail={"department_id": payload.department_id},
        )
        db.commit()
        return UserOut.model_validate(user)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.patch("/{user_id}/status", response_model=UserOut, dependencies=[AdminOnly])
def update_status(
    user_id: int,
    payload: StatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.ADMIN))],
) -> UserOut:
    service = UserService(db)
    try:
        user = service.update_user(user_id, UserUpdate(status=payload.status))
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_status_updated",
            resource_type="user",
            resource_id=user_id,
            detail={"status": payload.status.value},
        )
        db.commit()
        return UserOut.model_validate(user)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(require_roles(*ALL_ROLES))]) -> UserOut:
    return UserOut.model_validate(current_user)
