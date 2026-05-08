from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.user import UserStatus
from app.rbac.guards import require_any_permission, require_roles
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles
from app.schemas.user import (
    DepartmentAssignment,
    RoleAssignment,
    StatusUpdate,
    UserCreate,
    UserDeleteResult,
    UserFilterParams,
    UserListResponse,
    UserOut,
    UserUpdate,
)
from app.services.activity_service import ActivityService
from app.services.permission_service import PermissionService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

SystemAdminOnly = Depends(require_roles(Roles.SYSTEM_ADMIN))


def _user_out(db: Session, user: User, *, with_screens: bool) -> UserOut:
    base = UserOut.model_validate(user)
    if not with_screens:
        return base
    screens = PermissionService(db).allowed_screens_for_user(user)
    return base.model_copy(update={"allowed_screens": screens})


@router.get("/me", response_model=UserOut)
def me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    u = UserService(db).get_user(current_user.id)
    return _user_out(db, u, with_screens=True)


@router.get(
    "/consultants",
    response_model=UserListResponse,
    dependencies=[
        Depends(require_any_permission(PermissionKey.ASSIGNMENT_ASSIGN)),
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.TEAM_LEADER)),
    ],
)
def list_consultants_for_assignment(
    db: Annotated[Session, Depends(get_db)],
    department_id: int = Query(..., ge=1),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
) -> UserListResponse:
    service = UserService(db)
    users = service.list_consultants_for_assignment(department_id=department_id, q=q, limit=limit)
    return UserListResponse(
        items=[_user_out(db, u, with_screens=False) for u in users],
        total=len(users),
        limit=limit,
        offset=0,
    )


@router.get(
    "/assignable-workflow-users",
    response_model=UserListResponse,
    dependencies=[
        Depends(require_any_permission(PermissionKey.ASSIGNMENT_ASSIGN)),
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.TEAM_LEADER)),
    ],
)
def list_assignable_workflow_users(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=300),
) -> UserListResponse:
    service = UserService(db)
    users = service.list_assignable_workflow_users(q=q, limit=limit)
    return UserListResponse(
        items=[_user_out(db, u, with_screens=False) for u in users],
        total=len(users),
        limit=limit,
        offset=0,
    )


@router.get(
    "/consultants-directory",
    response_model=UserListResponse,
    dependencies=[
        Depends(require_any_permission(PermissionKey.CONSULTANT_VIEW)),
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.TEAM_LEADER, Roles.CONSULTANT)),
    ],
)
def list_consultants_directory(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=300),
) -> UserListResponse:
    service = UserService(db)
    users = service.list_consultants_directory(q=q, limit=limit)
    return UserListResponse(
        items=[_user_out(db, u, with_screens=False) for u in users],
        total=len(users),
        limit=limit,
        offset=0,
    )


@router.get(
    "/team-leaders",
    response_model=UserListResponse,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_VIEW)),
        SystemAdminOnly,
    ],
)
def list_team_leaders(
    db: Annotated[Session, Depends(get_db)],
    department_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=200, ge=1, le=200),
) -> UserListResponse:
    service = UserService(db)
    users = service.list_team_leaders_for_consultant_form(
        department_id=department_id,
        limit=limit,
    )
    return UserListResponse(
        items=[_user_out(db, u, with_screens=False) for u in users],
        total=len(users),
        limit=limit,
        offset=0,
    )


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_CREATE)),
        SystemAdminOnly,
    ],
)
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
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
        return _user_out(db, user, with_screens=False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "",
    response_model=UserListResponse,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_VIEW)),
        SystemAdminOnly,
    ],
)
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
        items=[_user_out(db, u, with_screens=False) for u in users],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


@router.put(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_UPDATE)),
        SystemAdminOnly,
    ],
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
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
        return _user_out(db, user, with_screens=False)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.delete(
    "/{user_id}",
    response_model=UserDeleteResult,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_DELETE)),
        SystemAdminOnly,
    ],
)
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> UserDeleteResult:
    service = UserService(db)
    try:
        action, message = service.delete_user_or_deactivate(user_id)
        ActivityService(db).record_audit(
            actor_user_id=actor.id,
            action="user_deactivated" if action == "deactivated" else "user_deleted",
            resource_type="user",
            resource_id=user_id,
            detail={"result": action},
        )
        db.commit()
        return UserDeleteResult(action=action, message=message)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch(
    "/{user_id}/roles",
    response_model=UserOut,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_UPDATE)),
        SystemAdminOnly,
    ],
)
def assign_roles(
    user_id: int,
    payload: RoleAssignment,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
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
        return _user_out(db, user, with_screens=False)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.patch(
    "/{user_id}/department",
    response_model=UserOut,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_UPDATE)),
        SystemAdminOnly,
    ],
)
def assign_department(
    user_id: int,
    payload: DepartmentAssignment,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
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
        return _user_out(db, user, with_screens=False)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.patch(
    "/{user_id}/status",
    response_model=UserOut,
    dependencies=[
        Depends(require_any_permission(PermissionKey.USERS_UPDATE)),
        SystemAdminOnly,
    ],
)
def update_status(
    user_id: int,
    payload: StatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
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
        return _user_out(db, user, with_screens=False)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "User not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
