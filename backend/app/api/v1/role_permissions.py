import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.role import Role
from app.models.role_screen_permission import RoleScreenPermission
from app.rbac.guards import require_any_permission, require_roles
from app.rbac.permissions import PERMISSION_MATRIX_COLUMNS, PermissionKey
from app.rbac.roles import Roles
from app.rbac.screens import default_screen_matrix, grants_for_matrix_response
from app.schemas.user import (
    RoleCreateIn,
    RoleOut,
    RolePermissionMatrixOut,
    RolePermissionMatrixUpdate,
    ScreenColumnOut,
)
from app.services.permission_service import MATRIX_ROLE_EMPTY_MARKER, PermissionService
from app.services.role_admin_service import create_custom_role

router = APIRouter(prefix="/role-permissions", tags=["role-permissions"])

logger = logging.getLogger(__name__)


def _parse_role_id_key(rid_str: str) -> int:
    try:
        rid = int(rid_str)
    except (TypeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role id key (expected integer string): {rid_str!r}",
        ) from e
    if rid < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role id: {rid}",
        )
    return rid


_matrix_deps = [
    Depends(require_any_permission(PermissionKey.ROLE_MANAGEMENT_VIEW)),
    Depends(require_roles(Roles.SYSTEM_ADMIN)),
]


@router.post("/roles", response_model=RoleOut, dependencies=_matrix_deps)
def create_custom_role_endpoint(
    payload: RoleCreateIn,
    db: Annotated[Session, Depends(get_db)],
) -> RoleOut:
    """Create a non-system role. Optionally clone matrix rows from an existing role."""
    try:
        role = create_custom_role(
            db,
            name=payload.name,
            code=payload.code,
            description=payload.description,
            clone_from_role_id=payload.clone_from_role_id,
            is_active=payload.is_active,
        )
        db.commit()
        db.refresh(role)
        return RoleOut.model_validate(role)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        logger.warning("create role failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create role (duplicate or database constraint).",
        ) from exc


@router.get("/matrix", response_model=RolePermissionMatrixOut, dependencies=_matrix_deps)
def get_permission_matrix(db: Annotated[Session, Depends(get_db)]) -> RolePermissionMatrixOut:
    roles = list(db.scalars(select(Role).order_by(Role.sort_order, Role.id)).all())
    svc = PermissionService(db)
    stored = svc.get_matrix()
    defaults = default_screen_matrix()
    total_perm_rows = db.scalar(select(func.count()).select_from(RoleScreenPermission)) or 0
    grants: dict[str, list[str]] = {}
    for r in roles:
        rid = str(r.id)
        if total_perm_rows == 0:
            keys = defaults.get(r.name)
            if keys is None and r.name == "Admin":
                keys = defaults.get("System Admin")
            if keys is None and r.name == "Approval Head":
                keys = defaults.get("Approval Head-PEC")
            grants[rid] = grants_for_matrix_response(set(keys)) if keys else []
        else:
            raw = set(stored.get(r.id, set()))
            if MATRIX_ROLE_EMPTY_MARKER in raw:
                grants[rid] = []
            elif raw:
                grants[rid] = grants_for_matrix_response(raw - {MATRIX_ROLE_EMPTY_MARKER})
            else:
                keys = defaults.get(r.name)
                if keys is None and r.name == "Admin":
                    keys = defaults.get("System Admin")
                if keys is None and r.name == "Approval Head":
                    keys = defaults.get("Approval Head-PEC")
                grants[rid] = grants_for_matrix_response(set(keys)) if keys else []
    cols = [ScreenColumnOut(group=g, key=k, label=label) for g, k, label in PERMISSION_MATRIX_COLUMNS]
    return RolePermissionMatrixOut(
        roles=[RoleOut.model_validate(x) for x in roles],
        columns=cols,
        grants=grants,
    )


@router.put("/matrix", dependencies=_matrix_deps)
def update_permission_matrix(
    payload: RolePermissionMatrixUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    svc = PermissionService(db)
    try:
        for rid_str, screens in payload.grants.items():
            rid = _parse_role_id_key(rid_str)
            if db.get(Role, rid) is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role id {rid}",
                )
            svc.set_role_screens(rid, set(screens))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as e:
        db.rollback()
        logger.warning("role-permissions matrix commit failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not save permission matrix (database constraint).",
        ) from e
    return {"ok": True}


@router.post("/reset", dependencies=_matrix_deps)
def reset_permission_matrix(db: Annotated[Session, Depends(get_db)]) -> dict[str, bool]:
    PermissionService(db).reset_all_to_defaults()
    db.commit()
    return {"ok": True}
