from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.letter import AssignmentWorkStatus
from app.models.user import User
from app.schemas.department import DepartmentOut


class AssignmentUserBrief(BaseModel):
    id: int
    full_name: str
    email: str
    roles: list[str] = Field(default_factory=list)
    department: DepartmentOut | None = None

    model_config = ConfigDict(from_attributes=True)


def assignment_user_brief(user: User) -> AssignmentUserBrief:
    return AssignmentUserBrief(
        id=user.id,
        full_name=user.full_name,
        email=str(user.email),
        roles=[r.name for r in user.roles],
        department=DepartmentOut.model_validate(user.department) if user.department else None,
    )


class AssignConsultantIn(BaseModel):
    consultant_id: int
    deadline_at: datetime
    comment: str = Field(min_length=2, max_length=500)


class ReassignConsultantIn(BaseModel):
    consultant_id: int
    deadline_at: datetime
    comment: str = Field(min_length=2, max_length=500)


class AssignmentOut(BaseModel):
    id: int
    letter_id: int
    consultant_id: int
    assigned_by: int
    deadline_at: datetime
    is_active: bool
    work_status: AssignmentWorkStatus
    resolution_note: str | None
    assigned_at: datetime
    updated_at: datetime
    consultant_user: AssignmentUserBrief | None = None
    assigned_by_user: AssignmentUserBrief | None = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentTrackingOut(BaseModel):
    letter_id: int
    serial_no: str
    subject: str
    assignments: list[AssignmentOut]
