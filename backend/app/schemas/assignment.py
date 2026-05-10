from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

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
    """Assign or forward to any active Team Leader or Consultant (``consultant_id`` kept as legacy alias)."""

    model_config = ConfigDict(populate_by_name=True)
    target_user_id: int = Field(validation_alias=AliasChoices("target_user_id", "consultant_id"))
    deadline_at: datetime | None = None
    comment: str = Field(min_length=2, max_length=2000)


class ReassignConsultantIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    target_user_id: int = Field(validation_alias=AliasChoices("target_user_id", "consultant_id"))
    deadline_at: datetime | None = None
    comment: str = Field(min_length=2, max_length=2000)


class AssignmentOut(BaseModel):
    id: int
    letter_id: int
    consultant_id: int
    assigned_by: int
    deadline_at: datetime | None = None
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
