import mimetypes
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.letter import (
    AssignmentSolutionFile,
    LetterAssignment,
    LetterPriority,
    LetterStatus,
)
from app.models.user import User as UserModel
from app.models.user import User
from app.rbac.guards import require_any_permission, require_letter_list_actor, require_roles, require_screen
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles
from app.rbac.screens import ScreenKey
from app.schemas.closure import ClosureHistoryOut, closure_history_out_from_letter
from app.schemas.letter import (
    LetterAdminUpdateIn,
    LetterLatestAssignmentOut,
    LetterLatestAssignmentUserOut,
    LetterListResponse,
    LetterOut,
)
from app.core.config import settings
from app.core.letter_access import is_admin
from app.services.activity_service import ActivityService
from app.services.closure_service import ClosureService
from app.services.letter_service import LetterService

router = APIRouter(prefix="/letters", tags=["letters"])

ReadLetterRoles = Depends(
    require_roles(
        Roles.ADMIN,
        Roles.RECEIVING_OFFICER,
        Roles.APPROVAL_HEAD,
        Roles.TEAM_LEADER,
        Roles.CONSULTANT,
    )
)


def _user_brief(u: UserModel | None) -> LetterLatestAssignmentUserOut | None:
    if u is None:
        return None
    return LetterLatestAssignmentUserOut(
        id=u.id,
        full_name=u.full_name,
        email=str(u.email),
        roles=[r.name for r in u.roles],
        department=u.department,
    )


def _latest_assignment_map(db: Session, letter_ids: list[int]) -> dict[int, LetterLatestAssignmentOut]:
    if not letter_ids:
        return {}
    rows = list(
        db.scalars(
            select(LetterAssignment)
            .where(
                LetterAssignment.letter_id.in_(letter_ids),
                LetterAssignment.is_active.is_(True),
            )
            .order_by(LetterAssignment.letter_id.asc(), LetterAssignment.id.desc())
        ).all()
    )
    if not rows:
        return {}

    by_letter: dict[int, LetterAssignment] = {}
    for a in rows:
        if a.letter_id not in by_letter:
            by_letter[a.letter_id] = a

    user_ids = {a.consultant_id for a in by_letter.values()} | {a.assigned_by for a in by_letter.values()}
    users = list(
        db.scalars(
            select(UserModel)
            .options(selectinload(UserModel.roles), selectinload(UserModel.department))
            .where(UserModel.id.in_(user_ids))
        ).all()
    )
    user_map = {u.id: u for u in users}
    assignment_ids = [a.id for a in by_letter.values()]
    file_rows = list(
        db.execute(
            select(
                AssignmentSolutionFile.assignment_id,
                func.max(AssignmentSolutionFile.uploaded_at),
            )
            .where(AssignmentSolutionFile.assignment_id.in_(assignment_ids))
            .group_by(AssignmentSolutionFile.assignment_id)
        ).all()
    )
    file_map = {assignment_id: uploaded_at for assignment_id, uploaded_at in file_rows}
    out: dict[int, LetterLatestAssignmentOut] = {}
    for letter_id, a in by_letter.items():
        latest_file_at = file_map.get(a.id)
        out[letter_id] = LetterLatestAssignmentOut(
            id=a.id,
            letter_id=a.letter_id,
            consultant_id=a.consultant_id,
            assigned_by=a.assigned_by,
            deadline_at=a.deadline_at,
            is_active=a.is_active,
            work_status=a.work_status,
            resolution_note=a.resolution_note,
            has_solution_file=latest_file_at is not None,
            latest_solution_file_uploaded_at=latest_file_at,
            assigned_at=a.assigned_at,
            updated_at=a.updated_at,
            consultant_user=_user_brief(user_map.get(a.consultant_id)),
            assigned_by_user=_user_brief(user_map.get(a.assigned_by)),
        )
    return out


@router.post(
    "",
    response_model=LetterOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_screen(ScreenKey.LETTERS_CREATE))],
)
def create_letter(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.RECEIVING_OFFICER))],
    subject: str = Form(..., min_length=1, max_length=255),
    received_from: str = Form(..., min_length=1, max_length=255),
    department_id: int | None = Form(default=None),
    priority: LetterPriority = Form(default=LetterPriority.NORMAL),
    memo_no: str | None = Form(default=None, max_length=160),
    file: UploadFile = File(...),
) -> LetterOut:
    service = LetterService(db)
    memo = (memo_no or "").strip() or None
    try:
        letter = service.create_letter(
            subject=subject.strip(),
            received_from=received_from.strip(),
            department_id=department_id,
            priority=priority,
            file=file,
            created_by=current_user,
            memo_no=memo,
        )
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="letter_created",
            resource_type="letter",
            resource_id=letter.id,
            detail={"serial_no": letter.serial_no, "subject": letter.subject},
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "",
    response_model=LetterListResponse,
)
def list_letters(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_letter_list_actor())],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: LetterStatus | None = Query(default=None),
    priority: LetterPriority | None = Query(default=None),
    department_id: int | None = Query(default=None),
    unassigned_only: bool = Query(default=False),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    from_office: str | None = Query(default=None, max_length=255),
    q: str | None = Query(default=None, max_length=200),
) -> LetterListResponse:
    if department_id is not None:
        if not is_admin(current_user):
            if current_user.department_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot filter by department for this account",
                )
            if department_id != current_user.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot list letters for another department",
                )
    service = LetterService(db)
    items, total = service.list_letters(
        current_user,
        limit=limit,
        offset=offset,
        status=status,
        priority=priority,
        department_id=department_id,
        unassigned_only=unassigned_only,
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


LetterReadScreen = Depends(
    require_any_permission(PermissionKey.LETTERS_VIEW, PermissionKey.CONSULTANT_VIEW)
)


@router.get(
    "/{letter_id}/action-history",
    response_model=ClosureHistoryOut,
    dependencies=[LetterReadScreen, ReadLetterRoles],
)
def letter_action_history(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                Roles.ADMIN,
                Roles.APPROVAL_HEAD,
                Roles.TEAM_LEADER,
                Roles.RECEIVING_OFFICER,
                Roles.CONSULTANT,
            )
        ),
    ],
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> ClosureHistoryOut:
    service = ClosureService(db)
    try:
        letter = service.get_history(
            letter_id,
            current_user,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        msg = str(exc)
        if "Insufficient role" in msg:
            code = status.HTTP_403_FORBIDDEN
        elif msg == "Letter not found":
            code = status.HTTP_404_NOT_FOUND
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=msg) from exc
    return closure_history_out_from_letter(letter)


@router.get(
    "/{letter_id}/attachment",
    dependencies=[LetterReadScreen, ReadLetterRoles],
)
def get_letter_attachment(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                Roles.ADMIN,
                Roles.RECEIVING_OFFICER,
                Roles.APPROVAL_HEAD,
                Roles.TEAM_LEADER,
                Roles.CONSULTANT,
            )
        ),
    ],
) -> FileResponse:
    """Stream the stored letter attachment file (auth + same visibility as letter detail)."""
    service = LetterService(db)
    try:
        letter = service.get_letter_for_user(letter_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    raw_path = Path(letter.pdf_path)
    resolved = raw_path if raw_path.is_absolute() else (Path.cwd() / raw_path).resolve()
    upload_root = Path(settings.letter_upload_dir).resolve()
    try:
        resolved.relative_to(upload_root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment path is invalid",
        ) from exc
    if not resolved.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    media_type, _ = mimetypes.guess_type(resolved.name)
    return FileResponse(
        path=resolved,
        media_type=media_type or "application/octet-stream",
        filename=resolved.name,
    )


@router.get("/{letter_id}", response_model=LetterOut, dependencies=[LetterReadScreen, ReadLetterRoles])
def get_letter(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                Roles.ADMIN,
                Roles.RECEIVING_OFFICER,
                Roles.APPROVAL_HEAD,
                Roles.TEAM_LEADER,
                Roles.CONSULTANT,
            )
        ),
    ],
) -> LetterOut:
    service = LetterService(db)
    try:
        letter = service.get_letter_for_user(letter_id, current_user)
        payload = LetterOut.model_validate(letter).model_dump()
        payload["latest_assignment"] = _latest_assignment_map(db, [letter.id]).get(letter.id)
        return LetterOut(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put(
    "/{letter_id}",
    response_model=LetterOut,
    dependencies=[Depends(require_any_permission(PermissionKey.LETTERS_UPDATE))],
)
def update_letter_admin(
    letter_id: int,
    payload: LetterAdminUpdateIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> LetterOut:
    service = LetterService(db)
    letter = service.get_letter(letter_id)
    if letter.department_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned workflow records cannot be modified.",
        )
    letter.memo_no = (payload.memo_no or "").strip() or None
    letter.subject = payload.subject.strip()
    letter.received_from = payload.received_from.strip()
    letter.priority = payload.priority
    ActivityService(db).record_audit(
        actor_user_id=current_user.id,
        action="letter_updated",
        resource_type="letter",
        resource_id=letter.id,
        detail={"serial_no": letter.serial_no},
    )
    db.commit()
    db.refresh(letter)
    return LetterOut.model_validate(letter)


@router.delete(
    "/{letter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_any_permission(PermissionKey.LETTERS_DELETE))],
)
def delete_letter_admin(
    letter_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.SYSTEM_ADMIN))],
) -> None:
    service = LetterService(db)
    letter = service.get_letter(letter_id)
    if letter.department_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned workflow records cannot be modified.",
        )
    ActivityService(db).record_audit(
        actor_user_id=current_user.id,
        action="letter_deleted",
        resource_type="letter",
        resource_id=letter.id,
        detail={"serial_no": letter.serial_no},
    )
    db.delete(letter)
    db.commit()
