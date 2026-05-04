from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.letter import LetterOut
from app.schemas.workflow import ApprovalQueueResponse, RouteLetterIn, WorkflowActionIn
from app.services.activity_service import ActivityService
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflow", tags=["workflow"])

WorkflowRoles = Depends(
    require_roles(
        Roles.ADMIN,
        Roles.APPROVAL_HEAD,
        Roles.TEAM_LEADER,
        Roles.RECEIVING_OFFICER,
    )
)


@router.get("/queue", response_model=ApprovalQueueResponse, dependencies=[WorkflowRoles])
def approval_queue(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER, Roles.RECEIVING_OFFICER))],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
) -> ApprovalQueueResponse:
    service = WorkflowService(db)
    items, total = service.get_approval_queue(current_user, limit, offset, q=q)
    return ApprovalQueueResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/letters/{letter_id}/approve", response_model=LetterOut, dependencies=[WorkflowRoles])
def approve_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))],
) -> LetterOut:
    service = WorkflowService(db)
    try:
        letter = service.approve(letter_id, payload.comment.strip(), current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_approved",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/letters/{letter_id}/reject", response_model=LetterOut, dependencies=[WorkflowRoles])
def reject_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))],
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


@router.post("/letters/{letter_id}/return", response_model=LetterOut, dependencies=[WorkflowRoles])
def return_letter(
    letter_id: int,
    payload: WorkflowActionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))],
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


@router.post("/letters/{letter_id}/route", response_model=LetterOut, dependencies=[WorkflowRoles])
def route_letter(
    letter_id: int,
    payload: RouteLetterIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))],
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
