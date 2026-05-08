from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notice import Notice
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.notice import NoticeCreateIn, NoticeListResponse, NoticeOut, NoticeUpdateIn
from app.services.activity_service import ActivityService

router = APIRouter(prefix="/notices", tags=["notices"])


@router.get("", response_model=NoticeListResponse)
def list_notices(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> NoticeListResponse:
    now = datetime.now(timezone.utc)
    active_clause = or_(Notice.expires_at.is_(None), Notice.expires_at >= now)
    base = select(Notice).where(Notice.is_active.is_(True), active_clause)
    count_stmt = select(func.count(Notice.id)).where(Notice.is_active.is_(True), active_clause)
    items = list(
        db.scalars(
            base.order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )
    total = db.scalar(count_stmt) or 0
    return NoticeListResponse(
        items=[NoticeOut.model_validate(n) for n in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=NoticeOut,
    status_code=status.HTTP_201_CREATED,
)
def create_notice(
    payload: NoticeCreateIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> NoticeOut:
    notice = Notice(
        title=payload.title.strip(),
        message=payload.message.strip(),
        created_by=current_user.id,
        expires_at=payload.expires_at,
        is_active=payload.is_active,
        is_pinned=payload.is_pinned,
    )
    db.add(notice)
    ActivityService(db).record_audit(
        actor_user_id=current_user.id,
        action="notice_created",
        resource_type="notice",
        resource_id=None,
        detail={"title": notice.title},
    )
    db.commit()
    db.refresh(notice)
    return NoticeOut.model_validate(notice)


@router.put("/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: int,
    payload: NoticeUpdateIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> NoticeOut:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    notice.title = payload.title.strip()
    notice.message = payload.message.strip()
    notice.expires_at = payload.expires_at
    notice.is_active = payload.is_active
    notice.is_pinned = payload.is_pinned
    notice.updated_at = datetime.now(timezone.utc)
    ActivityService(db).record_audit(
        actor_user_id=current_user.id,
        action="notice_updated",
        resource_type="notice",
        resource_id=notice.id,
        detail={"title": notice.title},
    )
    db.commit()
    db.refresh(notice)
    return NoticeOut.model_validate(notice)


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(
    notice_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> None:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    ActivityService(db).record_audit(
        actor_user_id=current_user.id,
        action="notice_deleted",
        resource_type="notice",
        resource_id=notice.id,
        detail={"title": notice.title},
    )
    db.delete(notice)
    db.commit()
