from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.department import Department
from app.models.role import Role
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.department import DepartmentOut
from app.schemas.user import RoleOut

router = APIRouter(prefix="/reference", tags=["reference"])

AdminManager = Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))


@router.get("/roles", response_model=list[RoleOut], dependencies=[AdminManager])
def list_roles(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[RoleOut]:
    stmt = select(Role)
    if q:
        stmt = stmt.where(Role.name.ilike(f"%{q.strip()}%"))
    rows = list(db.scalars(stmt.order_by(Role.name.asc()).limit(limit).offset(offset)).all())
    return [RoleOut.model_validate(r) for r in rows]


@router.get("/departments", response_model=list[DepartmentOut], dependencies=[AdminManager])
def list_departments(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[DepartmentOut]:
    stmt = select(Department)
    if q:
        qv = f"%{q.strip()}%"
        stmt = stmt.where(
            (Department.name.ilike(qv)) | (Department.code.ilike(qv))
        )
    rows = list(db.scalars(stmt.order_by(Department.name.asc()).limit(limit).offset(offset)).all())
    return [DepartmentOut.model_validate(r) for r in rows]
