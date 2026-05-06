from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.letter import LetterPriority, LetterStatus
from app.schemas.department import DepartmentOut


class LetterOut(BaseModel):
    id: int
    serial_no: str
    memo_no: str | None = None
    subject: str
    received_from: str
    pdf_path: str
    priority: LetterPriority
    status: LetterStatus
    department: DepartmentOut
    created_by: int
    created_at: datetime
    closed_at: datetime | None = None
    closed_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class LetterListResponse(BaseModel):
    items: list[LetterOut]
    total: int
    limit: int
    offset: int
