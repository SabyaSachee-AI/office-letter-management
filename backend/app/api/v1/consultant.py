from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.letter import AssignmentWorkStatus
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.assignment import AssignmentOut
from app.schemas.consultant import (
    ConsultantAssignedLetterListOut,
    ConsultantAssignedLetterOut,
    ConsultantResolutionIn,
    ConsultantStatusUpdateIn,
    ConsultantTransferIn,
)
from app.services.consultant_service import ConsultantService

router = APIRouter(prefix="/consultant", tags=["consultant"])


@router.get("/assignments", response_model=ConsultantAssignedLetterListOut)
def my_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.CONSULTANT))],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    work_status: AssignmentWorkStatus | None = Query(default=None),
) -> ConsultantAssignedLetterListOut:
    service = ConsultantService(db)
    items, total = service.list_assigned_letters(
        current_user,
        limit,
        offset,
        q=q,
        work_status=work_status,
    )
    mapped = [
        ConsultantAssignedLetterOut(
            assignment=AssignmentOut.model_validate(assignment),
            letter_id=letter.id,
            serial_no=letter.serial_no,
            subject=letter.subject,
            received_from=letter.received_from,
            deadline_at=assignment.deadline_at,
        )
        for assignment, letter in items
    ]
    return ConsultantAssignedLetterListOut(items=mapped, total=total, limit=limit, offset=offset)


@router.patch("/assignments/{assignment_id}/status", response_model=AssignmentOut)
def update_assignment_status(
    assignment_id: int,
    payload: ConsultantStatusUpdateIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.CONSULTANT))],
) -> AssignmentOut:
    service = ConsultantService(db)
    try:
        updated = service.update_status(
            assignment_id=assignment_id,
            work_status=payload.work_status,
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return AssignmentOut.model_validate(updated)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/assignments/{assignment_id}/resolution", response_model=AssignmentOut)
def add_resolution_note(
    assignment_id: int,
    payload: ConsultantResolutionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.CONSULTANT))],
) -> AssignmentOut:
    service = ConsultantService(db)
    try:
        updated = service.add_resolution_note(
            assignment_id=assignment_id,
            resolution_note=payload.resolution_note.strip(),
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return AssignmentOut.model_validate(updated)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/assignments/{assignment_id}/files", status_code=status.HTTP_201_CREATED)
def upload_solution_file(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.CONSULTANT))],
    comment: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, str]:
    service = ConsultantService(db)
    try:
        result = service.upload_solution_file(
            assignment_id=assignment_id,
            file=file,
            comment=comment.strip(),
            consultant_user=current_user,
        )
        return {"file_path": result.file_path}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/assignments/{assignment_id}/transfer", response_model=AssignmentOut)
def transfer_assignment(
    assignment_id: int,
    payload: ConsultantTransferIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.CONSULTANT))],
) -> AssignmentOut:
    service = ConsultantService(db)
    try:
        new_assignment = service.transfer_assignment(
            assignment_id=assignment_id,
            target_consultant_id=payload.target_consultant_id,
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return AssignmentOut.model_validate(new_assignment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
