from datetime import datetime

from pydantic import BaseModel, Field

from app.models.letter import AssignmentWorkStatus
from app.schemas.assignment import AssignmentOut
from app.schemas.department import DepartmentOut


class ConsultantAssignedLetterOut(BaseModel):
    assignment: AssignmentOut
    letter_id: int
    serial_no: str
    memo_no: str | None = None
    subject: str
    received_from: str
    deadline_at: datetime | None = None
    letter_department: DepartmentOut | None = None


class ConsultantAssignedLetterListOut(BaseModel):
    items: list[ConsultantAssignedLetterOut]
    total: int
    limit: int
    offset: int


class ConsultantStatusUpdateIn(BaseModel):
    work_status: AssignmentWorkStatus
    comment: str = Field(min_length=2, max_length=500)


class ConsultantResolutionIn(BaseModel):
    resolution_note: str = Field(min_length=3, max_length=2000)
    comment: str = Field(min_length=2, max_length=500)


class ConsultantTransferIn(BaseModel):
    target_user_id: int
    comment: str = Field(min_length=2, max_length=2000)
    deadline_at: datetime | None = None
