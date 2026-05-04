from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.letter import AssignmentWorkStatus


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

    model_config = ConfigDict(from_attributes=True)


class AssignmentTrackingOut(BaseModel):
    letter_id: int
    serial_no: str
    subject: str
    assignments: list[AssignmentOut]
