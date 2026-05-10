from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.letters import _latest_assignment_map
from app.db.session import get_db
from app.models.letter import Letter, LetterAssignment, LetterPriority, LetterStatus
from app.models.user import User
from app.rbac.guards import (
    require_any_permission,
    require_assignment_queue_actor,
    require_assignment_tracking_actor,
    require_roles,
)
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles, has_role_name
from app.schemas.assignment import (
    AssignmentOut,
    AssignmentTrackingOut,
    AssignConsultantIn,
    ReassignConsultantIn,
)
from app.schemas.letter import LetterListResponse, LetterOut
from app.services.activity_service import ActivityService
from app.services.assignment_service import AssignmentService
from app.services.letter_service import LetterService

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get(
    "/queue",
    response_model=LetterListResponse,
)
def assignment_queue_letters(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_assignment_queue_actor())],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: LetterStatus | None = Query(default=None),
    priority: LetterPriority | None = Query(default=None),
    department_id: int | None = Query(default=None, ge=1),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    from_office: str | None = Query(default=None, max_length=255),
    q: str | None = Query(default=None, max_length=200),
) -> LetterListResponse:
    """Letters routed to the current user as Team Leader (or all routed letters for admin)."""
    service = LetterService(db)
    items, total = service.list_assignment_queue_letters(
        current_user,
        limit=limit,
        offset=offset,
        status=status,
        priority=priority,
        department_id=department_id,
        date_from=date_from,
        date_to=date_to,
        from_office=(from_office.strip() or None) if from_office is not None else None,
        q=(q.strip() or None) if q is not None else None,
    )
    latest_map = _latest_assignment_map(db, [i.id for i in items])
    letter_out_items = []
    for item in items:
        payload = LetterOut.model_validate(item).model_dump()
        payload["latest_assignment"] = latest_map.get(item.id)
        letter_out_items.append(LetterOut(**payload))
    return LetterListResponse(items=letter_out_items, total=total, limit=limit, offset=offset)


@router.post(
    "/letters/{letter_id}/assign",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_permission(PermissionKey.ASSIGNMENT_ASSIGN))],
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
            recipient_user_id=payload.target_user_id,
            deadline_at=payload.deadline_at,
            comment=payload.comment.strip(),
            current_user=current_user,
        )
        target_u = db.scalar(
            select(User)
            .options(selectinload(User.roles), selectinload(User.department))
            .where(User.id == payload.target_user_id)
        )
        letter_row = db.get(Letter, letter_id)
        actor_roles = [r.name for r in current_user.roles]
        target_roles = [r.name for r in target_u.roles] if target_u else []
        target_primary = (
            "Team Leader"
            if target_u and has_role_name(target_u, Roles.TEAM_LEADER)
            else "Consultant"
        )
        tdept = (
            f"{target_u.department.name} ({target_u.department.code})"
            if target_u and getattr(target_u, "department", None) is not None
            else None
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="consultant_assigned",
            module="assignments",
            description="Assigned or forwarded letter to a Team Leader or Consultant",
            resource_type="letter",
            resource_id=letter_id,
            detail={
                "target_user_id": payload.target_user_id,
                "consultant_id": payload.target_user_id,
                "assignment_id": assignment.id,
                "target_full_name": target_u.full_name if target_u else None,
                "target_email": str(target_u.email) if target_u else None,
                "target_roles": target_roles,
                "target_primary_role": target_primary,
                "target_department": tdept,
                "actor_roles": actor_roles,
                "previous_assignee_id": None,
                "workflow_note": payload.comment.strip()[:2000],
                "letter_serial_no": letter_row.serial_no if letter_row else None,
                "letter_subject": letter_row.subject if letter_row else None,
            },
        )
        db.commit()
        return service.enrich_assignments([assignment])[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/letters/{letter_id}/reassign",
    response_model=AssignmentOut,
    dependencies=[Depends(require_any_permission(PermissionKey.ASSIGNMENT_REASSIGN))],
)
def reassign_consultant(
    letter_id: int,
    payload: ReassignConsultantIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.TEAM_LEADER))],
) -> AssignmentOut:
    service = AssignmentService(db)
    try:
        prev_active = db.scalar(
            select(LetterAssignment)
            .where(
                LetterAssignment.letter_id == letter_id,
                LetterAssignment.is_active.is_(True),
            )
            .order_by(LetterAssignment.id.desc())
        )
        previous_assignee_id = prev_active.consultant_id if prev_active else None

        assignment = service.reassign_consultant(
            letter_id=letter_id,
            recipient_user_id=payload.target_user_id,
            deadline_at=payload.deadline_at,
            comment=payload.comment.strip(),
            current_user=current_user,
        )
        target_u = db.scalar(
            select(User)
            .options(selectinload(User.roles), selectinload(User.department))
            .where(User.id == payload.target_user_id)
        )
        letter_row = db.get(Letter, letter_id)
        actor_roles = [r.name for r in current_user.roles]
        target_roles = [r.name for r in target_u.roles] if target_u else []
        target_primary = (
            "Team Leader"
            if target_u and has_role_name(target_u, Roles.TEAM_LEADER)
            else "Consultant"
        )
        tdept = (
            f"{target_u.department.name} ({target_u.department.code})"
            if target_u and getattr(target_u, "department", None) is not None
            else None
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="consultant_reassigned",
            module="assignments",
            description="Forwarded letter to another Team Leader or Consultant",
            resource_type="letter",
            resource_id=letter_id,
            detail={
                "target_user_id": payload.target_user_id,
                "consultant_id": payload.target_user_id,
                "assignment_id": assignment.id,
                "target_full_name": target_u.full_name if target_u else None,
                "target_email": str(target_u.email) if target_u else None,
                "target_roles": target_roles,
                "target_primary_role": target_primary,
                "target_department": tdept,
                "actor_roles": actor_roles,
                "previous_assignee_id": previous_assignee_id,
                "workflow_note": payload.comment.strip()[:2000],
                "letter_serial_no": letter_row.serial_no if letter_row else None,
                "letter_subject": letter_row.subject if letter_row else None,
            },
        )
        db.commit()
        return service.enrich_assignments([assignment])[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/letters/{letter_id}/tracking",
    response_model=AssignmentTrackingOut,
)
def assignment_tracking(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_assignment_tracking_actor())],
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
            assignments=service.enrich_assignments(assignments),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
