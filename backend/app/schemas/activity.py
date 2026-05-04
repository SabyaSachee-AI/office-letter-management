from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.activity import NotificationKind


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_email: str | None = None
    action: str
    resource_type: str | None
    resource_id: int | None
    detail_json: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int


class LoginLogOut(BaseModel):
    id: int
    email_attempted: str
    user_id: int | None
    user_email: str | None = None
    success: bool
    failure_reason: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginLogListResponse(BaseModel):
    items: list[LoginLogOut]
    total: int
    limit: int
    offset: int


class NotificationOut(BaseModel):
    id: int
    kind: NotificationKind
    title: str
    body: str
    letter_id: int | None
    link_path: str | None
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int
    limit: int
    offset: int


class MarkAllReadResult(BaseModel):
    marked_count: int = Field(ge=0)
