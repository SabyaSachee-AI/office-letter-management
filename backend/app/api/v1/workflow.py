from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.letter import LetterStatus
from app.models.user import User
from app.rbac.guards import require_permission, require_roles
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles
from app.schemas.letter import LetterOut
from app.schemas.workflow import ApprovalQueueResponse, RouteLetterIn, WorkflowActionIn
from app.services.activity_service import ActivityService
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflow", tags=["workflow"])

ApprovalActors = Depends(
    require_roles(
        Roles.SYSTEM_ADMIN,
        Roles.APPROVAL_HEAD_PEC,
    )
)
ApprovalQueueAccess = Depends(require_permission(PermissionKey.APPROVAL_VIEW))


@router.get(
    "/queue",
    response_model=ApprovalQueueResponse,
    dependencies=[ApprovalQueueAccess, ApprovalActors],
)
def approval_queue(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                Roles.SYSTEM_ADMIN,
                Roles.APPROVAL_HEAD_PEC,
            )
        ),
    ],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: LetterStatus | None = Query(default=None),
    department_id: int | None = Query(default=None),
    from_office: str | None = Query(default=None, max_length=255),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    q: str | None = Query(default=None),
) -> ApprovalQueueResponse:
    service = WorkflowService(db)
    items, total = service.get_approval_queue(
        current_user,
        limit,
        offset,
        status=status,
        department_id=department_id,
        from_office=(from_office.strip() or None) if from_office is not None else None,
        date_from=date_from,
        date_to=date_to,
        q=(q.strip() or None) if q is not None else None,
    )
    return ApprovalQueueResponse(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/letters/{letter_id}/approve",
    response_model=LetterOut,
    dependencies=[
        Depends(require_permission(PermissionKey.APPROVAL_APPROVE)),
        ApprovalActors,
    ],
)
def approve_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.APPROVAL_HEAD_PEC)),
    ],
) -> LetterOut:
    service = WorkflowService(db)
    try:
        letter = service.approve(
            letter_id,
            payload.comment.strip(),
            current_user,
            target_department_id=payload.target_department_id,
            priority=payload.priority,
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_approved",
            resource_type="letter",
            resource_id=letter_id,
            detail={
                "target_department_id": payload.target_department_id,
                "priority": payload.priority.value if payload.priority is not None else None,
            },
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/letters/{letter_id}/reject",
    response_model=LetterOut,
    dependencies=[
        Depends(require_permission(PermissionKey.APPROVAL_REJECT)),
        ApprovalActors,
    ],
)
def reject_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.APPROVAL_HEAD_PEC)),
    ],
) -> LetterOut:
    service = WorkflowService(db)
    try:
        letter = service.reject(letter_id, payload.comment.strip(), current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_rejected",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/letters/{letter_id}/return",
    response_model=LetterOut,
    dependencies=[
        Depends(require_permission(PermissionKey.APPROVAL_RETURN)),
        ApprovalActors,
    ],
)
def return_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.APPROVAL_HEAD_PEC)),
    ],
) -> LetterOut:
    service = WorkflowService(db)
    try:
        letter = service.return_for_correction(letter_id, payload.comment.strip(), current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_returned_for_correction",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/letters/{letter_id}/route",
    response_model=LetterOut,
    dependencies=[
        Depends(require_permission(PermissionKey.APPROVAL_ROUTE)),
        ApprovalActors,
    ],
)
def route_letter(
    letter_id: int,
    payload: RouteLetterIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(require_roles(Roles.SYSTEM_ADMIN, Roles.APPROVAL_HEAD_PEC)),
    ],
) -> LetterOut:
    service = WorkflowService(db)
    try:
        letter = service.route_to_department(
            letter_id=letter_id,
            target_department_id=payload.target_department_id,
            comment=payload.comment.strip(),
            user=current_user,
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_routed",
            resource_type="letter",
            resource_id=letter_id,
            detail={"target_department_id": payload.target_department_id},
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
