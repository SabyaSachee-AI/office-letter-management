from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoticeCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    message: str = Field(min_length=2, max_length=5000)
    expires_at: datetime | None = None
    is_pinned: bool = False
    is_active: bool = True


class NoticeUpdateIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    message: str = Field(min_length=2, max_length=5000)
    expires_at: datetime | None = None
    is_pinned: bool = False
    is_active: bool = True


class NoticeOut(BaseModel):
    id: int
    title: str
    message: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None = None
    is_active: bool
    is_pinned: bool

    model_config = ConfigDict(from_attributes=True)


class NoticeListResponse(BaseModel):
    items: list[NoticeOut]
    total: int
    limit: int
    offset: int
