from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.letter import AssignmentWorkStatus, LetterPriority, LetterStatus
from app.schemas.department import DepartmentOut


class LetterLatestAssignmentUserOut(BaseModel):
    id: int
    full_name: str
    email: str
    roles: list[str]
    department: DepartmentOut | None = None

    model_config = ConfigDict(from_attributes=True)


class LetterLatestAssignmentOut(BaseModel):
    id: int
    letter_id: int
    consultant_id: int
    assigned_by: int
    deadline_at: datetime
    is_active: bool
    work_status: AssignmentWorkStatus
    resolution_note: str | None = None
    has_solution_file: bool = False
    latest_solution_file_uploaded_at: datetime | None = None
    assigned_at: datetime
    updated_at: datetime
    consultant_user: LetterLatestAssignmentUserOut | None = None
    assigned_by_user: LetterLatestAssignmentUserOut | None = None

    model_config = ConfigDict(from_attributes=True)


class LetterOut(BaseModel):
    id: int
    serial_no: str
    memo_no: str | None = None
    subject: str
    received_from: str
    pdf_path: str
    priority: LetterPriority
    status: LetterStatus
    department: DepartmentOut | None = None
    created_by: int
    created_at: datetime
    closed_at: datetime | None = None
    closed_by: int | None = None
    latest_assignment: LetterLatestAssignmentOut | None = None

    model_config = ConfigDict(from_attributes=True)


class LetterListResponse(BaseModel):
    items: list[LetterOut]
    total: int
    limit: int
    offset: int


class LetterAdminUpdateIn(BaseModel):
    memo_no: str | None = None
    subject: str
    received_from: str
    priority: LetterPriority
