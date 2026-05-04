from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.letter import LetterPriority, LetterStatus
from app.models.user import User
from app.rbac.guards import require_roles
from app.rbac.roles import Roles
from app.schemas.closure import ClosureHistoryOut, closure_history_out_from_letter
from app.schemas.letter import LetterListResponse, LetterOut
from app.core.letter_access import is_admin
from app.services.activity_service import ActivityService
from app.services.closure_service import ClosureService
from app.services.letter_service import LetterService

router = APIRouter(prefix="/letters", tags=["letters"])

CreateLetterRoles = Depends(
    require_roles(
        Roles.ADMIN,
        Roles.RECEIVING_OFFICER,
        Roles.APPROVAL_HEAD,
        Roles.TEAM_LEADER,
    )
)

ViewLetterRoles = Depends(
    require_roles(
        Roles.ADMIN,
        Roles.RECEIVING_OFFICER,
        Roles.APPROVAL_HEAD,
        Roles.TEAM_LEADER,
        Roles.CONSULTANT,
    )
)


@router.post("", response_model=LetterOut, status_code=status.HTTP_201_CREATED, dependencies=[CreateLetterRoles])
def create_letter(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(Roles.ADMIN, Roles.RECEIVING_OFFICER, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER))],
    subject: str = Form(..., min_length=1, max_length=255),
    received_from: str = Form(..., min_length=1, max_length=255),
    department_id: int = Form(...),
    priority: LetterPriority = Form(default=LetterPriority.NORMAL),
    file: UploadFile = File(...),
) -> LetterOut:
    service = LetterService(db)
    try:
        letter = service.create_letter(
            subject=subject.strip(),
            received_from=received_from.strip(),
            department_id=department_id,
            priority=priority,
            file=file,
            created_by=current_user,
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


@router.get("", response_model=LetterListResponse, dependencies=[ViewLetterRoles])
def list_letters(
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
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: LetterStatus | None = Query(default=None),
    department_id: int | None = Query(default=None),
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
        department_id=department_id,
        q=(q.strip() or None) if q is not None else None,
    )
    return LetterListResponse(
        items=[LetterOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{letter_id}/action-history",
    response_model=ClosureHistoryOut,
    dependencies=[ViewLetterRoles],
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


@router.get("/{letter_id}", response_model=LetterOut, dependencies=[ViewLetterRoles])
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
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
