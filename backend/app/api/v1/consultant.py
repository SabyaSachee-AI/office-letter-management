from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.letter import AssignmentWorkStatus
from app.models.user import User
from app.rbac.guards import require_any_permission, require_consultant_workspace_actor
from app.rbac.permissions import PermissionKey
from app.schemas.assignment import AssignmentOut
from app.schemas.consultant import (
    ConsultantAssignedLetterListOut,
    ConsultantAssignedLetterOut,
    ConsultantResolutionIn,
    ConsultantStatusUpdateIn,
    ConsultantTransferIn,
)
from app.schemas.department import DepartmentOut
from app.services.assignment_service import AssignmentService
from app.services.consultant_service import ConsultantService

router = APIRouter(prefix="/consultant", tags=["consultant"])


@router.get(
    "/assignments",
    response_model=ConsultantAssignedLetterListOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CONSULTANT_VIEW))],
)
def my_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_consultant_workspace_actor())],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    from_office: str | None = Query(default=None, max_length=255),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    work_status: AssignmentWorkStatus | None = Query(default=None),
) -> ConsultantAssignedLetterListOut:
    service = ConsultantService(db)
    items, total = service.list_assigned_letters(
        current_user,
        limit,
        offset,
        q=(q.strip() or None) if q is not None else None,
        from_office=(from_office.strip() or None) if from_office is not None else None,
        date_from=date_from,
        date_to=date_to,
        work_status=work_status,
    )
    assign_service = AssignmentService(db)
    assignment_rows = [pair[0] for pair in items]
    enriched = assign_service.enrich_assignments(assignment_rows)
    mapped = [
        ConsultantAssignedLetterOut(
            assignment=enriched[i],
            letter_id=letter.id,
            serial_no=letter.serial_no,
            memo_no=letter.memo_no,
            subject=letter.subject,
            received_from=letter.received_from,
            deadline_at=assignment_rows[i].deadline_at,
            letter_department=DepartmentOut.model_validate(letter.department)
            if letter.department
            else None,
        )
        for i, (_, letter) in enumerate(items)
    ]
    return ConsultantAssignedLetterListOut(items=mapped, total=total, limit=limit, offset=offset)


@router.patch(
    "/assignments/{assignment_id}/status",
    response_model=AssignmentOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CONSULTANT_UPDATE))],
)
def update_assignment_status(
    assignment_id: int,
    payload: ConsultantStatusUpdateIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_consultant_workspace_actor())],
) -> AssignmentOut:
    service = ConsultantService(db)
    assign_service = AssignmentService(db)
    try:
        updated = service.update_status(
            assignment_id=assignment_id,
            work_status=payload.work_status,
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return assign_service.enrich_assignments([updated])[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch(
    "/assignments/{assignment_id}/resolution",
    response_model=AssignmentOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CONSULTANT_RESOLVE))],
)
def add_resolution_note(
    assignment_id: int,
    payload: ConsultantResolutionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_consultant_workspace_actor())],
) -> AssignmentOut:
    service = ConsultantService(db)
    assign_service = AssignmentService(db)
    try:
        updated = service.add_resolution_note(
            assignment_id=assignment_id,
            resolution_note=payload.resolution_note.strip(),
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return assign_service.enrich_assignments([updated])[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/assignments/{assignment_id}/files",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_permission(PermissionKey.CONSULTANT_UPLOAD))],
)
def upload_solution_file(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_consultant_workspace_actor())],
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


@router.post(
    "/assignments/{assignment_id}/transfer",
    response_model=AssignmentOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CONSULTANT_TRANSFER))],
)
def transfer_assignment(
    assignment_id: int,
    payload: ConsultantTransferIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_consultant_workspace_actor())],
) -> AssignmentOut:
    service = ConsultantService(db)
    assign_service = AssignmentService(db)
    try:
        new_assignment = service.transfer_assignment(
            assignment_id=assignment_id,
            target_consultant_id=payload.target_consultant_id,
            comment=payload.comment.strip(),
            consultant_user=current_user,
        )
        return assign_service.enrich_assignments([new_assignment])[0]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
