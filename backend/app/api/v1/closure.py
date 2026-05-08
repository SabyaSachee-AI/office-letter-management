from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.rbac.guards import require_any_permission, require_closure_close_actor, require_closure_review_actor, require_roles
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles
from app.schemas.closure import (
    CloseIssueIn,
    ClosureHistoryOut,
    FinalCommentIn,
    ReviewSolutionIn,
    closure_history_out_from_letter,
)
from app.schemas.letter import LetterOut
from app.services.activity_service import ActivityService
from app.services.closure_service import ClosureService

router = APIRouter(prefix="/closure", tags=["closure"])


def _map_closure_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc)
    if msg == "Letter not found":
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.post(
    "/letters/{letter_id}/review-solution",
    response_model=LetterOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CLOSURE_REVIEW))],
)
def review_solution(
    letter_id: int,
    payload: ReviewSolutionIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_closure_review_actor())],
) -> LetterOut:
    service = ClosureService(db)
    try:
        letter = service.review_solution(letter_id, payload.review_comment, current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="closure_review_solution",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise _map_closure_value_error(exc) from exc


@router.post(
    "/letters/{letter_id}/final-comment",
    response_model=LetterOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CLOSURE_REVIEW))],
)
def add_final_comment(
    letter_id: int,
    payload: FinalCommentIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_closure_review_actor())],
) -> LetterOut:
    service = ClosureService(db)
    try:
        letter = service.add_final_comment(letter_id, payload.comment, current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="closure_final_comment",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise _map_closure_value_error(exc) from exc


@router.post(
    "/letters/{letter_id}/close",
    response_model=LetterOut,
    dependencies=[Depends(require_any_permission(PermissionKey.CLOSURE_CLOSE))],
)
def close_issue(
    letter_id: int,
    payload: CloseIssueIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_closure_close_actor())],
) -> LetterOut:
    service = ClosureService(db)
    try:
        letter = service.close_issue(letter_id, payload.final_comment, current_user)
        ActivityService(db).record_audit(
            actor_user_id=current_user.id,
            action="closure_close_issue",
            resource_type="letter",
            resource_id=letter_id,
            detail=None,
        )
        db.commit()
        return LetterOut.model_validate(letter)
    except ValueError as exc:
        raise _map_closure_value_error(exc) from exc


@router.get(
    "/letters/{letter_id}/history",
    response_model=ClosureHistoryOut,
    dependencies=[
        Depends(
            require_any_permission(
                PermissionKey.CLOSURE_VIEW,
                PermissionKey.LETTERS_VIEW,
                PermissionKey.CONSULTANT_VIEW,
                PermissionKey.APPROVAL_VIEW,
            )
        )
    ],
)
def closure_history(
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
