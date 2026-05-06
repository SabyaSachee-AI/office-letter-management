from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.role import Role
from app.rbac.guards import require_roles, require_screen
from app.rbac.roles import Roles
from app.rbac.screens import MATRIX_COLUMNS, ScreenKey, default_screen_matrix, expand_legacy_letters
from app.schemas.user import RoleOut, RolePermissionMatrixOut, RolePermissionMatrixUpdate, ScreenColumnOut
from app.services.permission_service import PermissionService

router = APIRouter(prefix="/role-permissions", tags=["role-permissions"])

_matrix_deps = [
    Depends(require_screen(ScreenKey.ROLE_MANAGEMENT)),
    Depends(require_roles(Roles.SYSTEM_ADMIN)),
]


@router.get("/matrix", response_model=RolePermissionMatrixOut, dependencies=_matrix_deps)
def get_permission_matrix(db: Annotated[Session, Depends(get_db)]) -> RolePermissionMatrixOut:
    roles = list(db.scalars(select(Role).order_by(Role.sort_order, Role.id)).all())
    svc = PermissionService(db)
    stored = svc.get_matrix()
    defaults = default_screen_matrix()
    grants: dict[str, list[str]] = {}
    for r in roles:
        rid = str(r.id)
        if r.id in stored and len(stored[r.id]) > 0:
            grants[rid] = sorted(expand_legacy_letters(set(stored[r.id])))
            continue
        keys = defaults.get(r.name)
        if keys is None and r.name == "Admin":
            keys = defaults.get("System Admin")
        if keys is None and r.name == "Approval Head":
            keys = defaults.get("Approval Head-PEC")
        grants[rid] = sorted(keys) if keys else []
    cols = [ScreenColumnOut(key=k, label=lab) for k, lab in MATRIX_COLUMNS]
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
    for rid_str, screens in payload.grants.items():
        rid = int(rid_str)
        if db.get(Role, rid) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role id {rid}",
            )
        svc.set_role_screens(rid, set(screens))
    db.commit()
    return {"ok": True}


@router.post("/reset", dependencies=_matrix_deps)
def reset_permission_matrix(db: Annotated[Session, Depends(get_db)]) -> dict[str, bool]:
    PermissionService(db).reset_all_to_defaults()
    db.commit()
    return {"ok": True}
