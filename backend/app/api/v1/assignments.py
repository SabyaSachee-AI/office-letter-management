from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_any_screen, require_roles, require_screen
from app.rbac.roles import Roles
from app.rbac.screens import ScreenKey
from app.schemas.assignment import (
    AssignmentOut,
    AssignmentTrackingOut,
    AssignConsultantIn,
    ReassignConsultantIn,
)
from app.services.activity_service import ActivityService
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post(
    "/letters/{letter_id}/assign",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_screen(ScreenKey.ASSIGNMENT))],
)
def assign_consultant(
    letter_id: int,
    payload: AssignConsultantIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.TEAM_LEADER))],
) -> AssignmentOut:
    service = AssignmentService(db)
    try:
        assignment = service.assign_consultant(
            letter_id=letter_id,
            consultant_id=payload.consultant_id,
            deadline_at=payload.deadline_at,
            comment=payload.comment.strip(),
            current_user=current_user,
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="consultant_assigned",
            resource_type="letter",
            resource_id=letter_id,
            detail={"consultant_id": payload.consultant_id, "assignment_id": assignment.id},
        )
        db.commit()
        return AssignmentOut.model_validate(assignment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/letters/{letter_id}/reassign", response_model=AssignmentOut)
def reassign_consultant(
    letter_id: int,
    payload: ReassignConsultantIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.TEAM_LEADER))],
) -> AssignmentOut:
    service = AssignmentService(db)
    try:
        assignment = service.reassign_consultant(
            letter_id=letter_id,
            consultant_id=payload.consultant_id,
            deadline_at=payload.deadline_at,
            comment=payload.comment.strip(),
            current_user=current_user,
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="consultant_reassigned",
            resource_type="letter",
            resource_id=letter_id,
            detail={"consultant_id": payload.consultant_id, "assignment_id": assignment.id},
        )
        db.commit()
        return AssignmentOut.model_validate(assignment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/letters/{letter_id}/tracking",
    response_model=AssignmentTrackingOut,
    dependencies=[
        Depends(
            require_any_screen(
                ScreenKey.ASSIGNMENT,
                ScreenKey.LETTERS_VIEW,
                ScreenKey.CONSULTANT,
                ScreenKey.APPROVAL,
            )
        )
    ],
)
def assignment_tracking(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                Roles.ADMIN,
                Roles.TEAM_LEADER,
                Roles.APPROVAL_HEAD,
                Roles.RECEIVING_OFFICER,
                Roles.CONSULTANT,
            )
        ),
    ],
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> AssignmentTrackingOut:
    service = AssignmentService(db)
    try:
        letter, assignments = service.get_assignment_tracking_paginated(
            letter_id,
            current_user,
            limit=limit,
            offset=offset,
        )
        return AssignmentTrackingOut(
            letter_id=letter.id,
            serial_no=letter.serial_no,
            subject=letter.subject,
            assignments=[AssignmentOut.model_validate(item) for item in assignments],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
