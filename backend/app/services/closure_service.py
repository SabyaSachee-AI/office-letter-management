from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.letter import (
    AssignmentWorkStatus,
    Letter,
    LetterAction,
    LetterActionType,
    LetterAssignment,
    LetterStatus,
)
from app.core.letter_access import can_view_letter
from app.models.activity import NotificationKind
from app.models.user import User
from app.rbac.roles import Roles
from app.services.activity_service import ActivityService


class ClosureService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _is_admin(user: User) -> bool:
        return any(r.name == Roles.ADMIN for r in user.roles)

    @staticmethod
    def _can_close_review(user: User) -> bool:
        allowed = {Roles.ADMIN, Roles.APPROVAL_HEAD, Roles.TEAM_LEADER}
        return any(r.name in allowed for r in user.roles)

    @staticmethod
    def _can_view_history(user: User) -> bool:
        allowed = {
            Roles.ADMIN,
            Roles.APPROVAL_HEAD,
            Roles.TEAM_LEADER,
            Roles.RECEIVING_OFFICER,
            Roles.CONSULTANT,
        }
        return any(r.name in allowed for r in user.roles)

    def _get_letter(self, letter_id: int, *, with_actions: bool = True) -> Letter:
        stmt = select(Letter).options(selectinload(Letter.department))
        if with_actions:
            stmt = stmt.options(
                selectinload(Letter.actions).selectinload(LetterAction.actor),
            )
        letter = self.db.scalar(stmt.where(Letter.id == letter_id))
        if letter is None:
            raise ValueError("Letter not found")
        return letter

    def _get_history_actions(
        self,
        letter_id: int,
        *,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[LetterAction]:
        stmt = (
            select(LetterAction)
            .options(selectinload(LetterAction.actor))
            .where(LetterAction.letter_id == letter_id)
            .order_by(LetterAction.id.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)
        return list(self.db.scalars(stmt).all())

    def _assert_department_access(self, letter: Letter, user: User) -> None:
        if not can_view_letter(self.db, user, letter):
            raise ValueError("Letter not found")

    def _active_assignment(self, letter_id: int) -> LetterAssignment | None:
        return self.db.scalar(
            select(LetterAssignment)
            .options(selectinload(LetterAssignment.files))
            .where(
                LetterAssignment.letter_id == letter_id,
                LetterAssignment.is_active.is_(True),
            )
        )

    def _append_action(
        self,
        letter_id: int,
        action: LetterActionType,
        comment: str,
        acted_by: int,
    ) -> None:
        self.db.add(
            LetterAction(
                letter_id=letter_id,
                action=action,
                comment=comment,
                acted_by=acted_by,
            )
        )

    def _has_action(self, letter: Letter, action: LetterActionType) -> bool:
        return any(a.action == action for a in letter.actions)

    def review_solution(self, letter_id: int, review_comment: str, user: User) -> Letter:
        if not self._can_close_review(user):
            raise ValueError("Insufficient role to review solution")
        letter = self._get_letter(letter_id)
        self._assert_department_access(letter, user)
        if letter.status in (LetterStatus.CLOSED, LetterStatus.REJECTED):
            raise ValueError("Letter cannot be reviewed in current status")

        assignment = self._active_assignment(letter_id)
        if assignment is None:
            raise ValueError("No active assignment to review")

        has_files = bool(assignment.files)
        has_resolution = bool((assignment.resolution_note or "").strip())
        if assignment.work_status != AssignmentWorkStatus.RESOLVED and not has_resolution and not has_files:
            raise ValueError("Consultant must resolve, add a resolution note, or upload a solution file first")

        self._append_action(letter_id, LetterActionType.REVIEW_SOLUTION, review_comment.strip(), user.id)
        self.db.commit()
        return self._get_letter(letter_id)

    def add_final_comment(self, letter_id: int, comment: str, user: User) -> Letter:
        if not self._can_close_review(user):
            raise ValueError("Insufficient role to add final comment")
        letter = self._get_letter(letter_id)
        self._assert_department_access(letter, user)
        if letter.status == LetterStatus.CLOSED:
            raise ValueError("Letter is already closed")

        self._append_action(letter_id, LetterActionType.FINAL_COMMENT, comment.strip(), user.id)
        self.db.commit()
        return self._get_letter(letter_id)

    def close_issue(self, letter_id: int, final_comment: str, user: User) -> Letter:
        if not self._can_close_review(user):
            raise ValueError("Insufficient role to close issue")
        letter = self._get_letter(letter_id)
        self._assert_department_access(letter, user)
        if letter.status == LetterStatus.CLOSED:
            raise ValueError("Letter is already closed")
        if letter.status == LetterStatus.REJECTED:
            raise ValueError("Rejected letters cannot be closed via this workflow")

        if not self._has_action(letter, LetterActionType.REVIEW_SOLUTION):
            raise ValueError("Solution must be reviewed before closure")

        self._append_action(letter_id, LetterActionType.FINAL_COMMENT, final_comment.strip(), user.id)
        self._append_action(
            letter_id,
            LetterActionType.CLOSE_ISSUE,
            "Issue formally closed.",
            user.id,
        )

        letter.status = LetterStatus.CLOSED
        letter.closed_at = datetime.now(timezone.utc)
        letter.closed_by = user.id

        assignment = self._active_assignment(letter_id)
        if assignment:
            assignment.is_active = False
            assignment.work_status = AssignmentWorkStatus.RESOLVED
            assignment.updated_at = datetime.now(timezone.utc)

        ActivityService(self.db).create_notification(
            user_id=letter.created_by,
            kind=NotificationKind.LETTER_CLOSED,
            title=f"Letter closed: {letter.serial_no}",
            body=f"The issue for «{letter.subject}» was formally closed.",
            letter_id=letter.id,
            link_path=f"/letters/{letter.id}",
        )

        self.db.commit()
        self.db.refresh(letter)
        return letter

    def get_history(
        self,
        letter_id: int,
        user: User,
        *,
        limit: int | None = None,
        offset: int = 0,
    ) -> Letter:
        if not self._can_view_history(user):
            raise ValueError("Insufficient role to view closure history")
        letter = self._get_letter(letter_id, with_actions=False)
        self._assert_department_access(letter, user)
        letter.actions = self._get_history_actions(letter_id, limit=limit, offset=offset)
        return letter
