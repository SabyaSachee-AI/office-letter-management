from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.letter import LetterActionType


class ReviewSolutionIn(BaseModel):
    review_comment: str = Field(min_length=3, max_length=2000)


class FinalCommentIn(BaseModel):
    comment: str = Field(min_length=3, max_length=2000)


class CloseIssueIn(BaseModel):
    final_comment: str = Field(min_length=3, max_length=2000)


class LetterActionHistoryOut(BaseModel):
    id: int
    action: LetterActionType
    comment: str
    acted_by: int
    from_department_id: int | None
    to_department_id: int | None
    created_at: datetime
    acted_by_full_name: str | None = None
    acted_by_email: str | None = None
    acted_by_roles: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


def closure_history_out_from_letter(letter) -> "ClosureHistoryOut":
    actions_sorted = sorted(letter.actions, key=lambda a: a.id)
    items: list[LetterActionHistoryOut] = []
    for a in actions_sorted:
        row = LetterActionHistoryOut.model_validate(a)
        actor = getattr(a, "actor", None)
        if actor is not None:
            row = row.model_copy(
                update={
                    "acted_by_full_name": actor.full_name,
                    "acted_by_email": actor.email,
                    "acted_by_roles": [r.name for r in getattr(actor, "roles", [])],
                }
            )
        items.append(row)
    return ClosureHistoryOut(
        letter_id=letter.id,
        serial_no=letter.serial_no,
        status=letter.status.value,
        actions=items,
    )


class ClosureHistoryOut(BaseModel):
    letter_id: int
    serial_no: str
    status: str
    actions: list[LetterActionHistoryOut]
