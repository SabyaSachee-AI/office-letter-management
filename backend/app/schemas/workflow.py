from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.letter import LetterActionType, LetterPriority, LetterStatus
from app.schemas.department import DepartmentOut


class WorkflowActionIn(BaseModel):
    comment: str = Field(min_length=2, max_length=500)


class RouteLetterIn(WorkflowActionIn):
    target_department_id: int


class LetterActionOut(BaseModel):
    id: int
    action: LetterActionType
    comment: str
    acted_by: int
    from_department_id: int | None
    to_department_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalQueueItemOut(BaseModel):
    id: int
    serial_no: str
    memo_no: str | None = None
    subject: str
    received_from: str
    status: LetterStatus
    priority: LetterPriority
    department: DepartmentOut
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalQueueResponse(BaseModel):
    items: list[ApprovalQueueItemOut]
    total: int
    limit: int
    offset: int
