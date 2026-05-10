from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.activity import NotificationKind


class AuditLogResolvedUserOut(BaseModel):
    id: int
    full_name: str
    email: str


class AuditLogResolvedDepartmentOut(BaseModel):
    id: int
    name: str
    code: str


class AuditLogResolvedLetterOut(BaseModel):
    id: int
    serial_no: str
    subject: str | None = None


class AuditLogResolvedAssignmentOut(BaseModel):
    id: int
    letter_id: int | None = None


class AuditLogResolvedContextOut(BaseModel):
    """Resolved names for audit log display (batch-loaded when listing logs)."""

    consultant: AuditLogResolvedUserOut | None = None
    target_consultant: AuditLogResolvedUserOut | None = None
    department: AuditLogResolvedDepartmentOut | None = None
    letter: AuditLogResolvedLetterOut | None = None
    assignment: AuditLogResolvedAssignmentOut | None = None


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_email: str | None = None
    user_name: str | None = None
    role: str | None = None
    module: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    description: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    resource_type: str | None
    resource_id: int | None
    detail_json: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    resolved: AuditLogResolvedContextOut | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int


class AuditLogFilterOptionsOut(BaseModel):
    modules: list[str]
    actions: list[str]


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
    type: str | None = None
    title: str
    body: str
    message: str | None = None
    letter_id: int | None
    link_path: str | None
    link_url: str | None = None
    event_code: str | None = None
    route_module: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    read_at: datetime | None
    is_read: bool | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int
    limit: int
    offset: int
    unread_total: int = Field(default=0, ge=0, description="All unread notifications for this user")


class MarkAllReadResult(BaseModel):
    marked_count: int = Field(ge=0)
