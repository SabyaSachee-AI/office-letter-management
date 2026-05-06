from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.letter_access import assert_assigning_user_can_access_letter, can_view_letter
from app.models.activity import NotificationKind
from app.models.letter import Letter, LetterAction, LetterActionType, LetterAssignment, LetterStatus
from app.models.user import User
from app.rbac.roles import Roles, has_role_name
from app.services.activity_service import ActivityService


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _has_role(user: User, role_name: str) -> bool:
        return has_role_name(user, role_name)

    def _get_letter(self, letter_id: int) -> Letter:
        letter = self.db.get(Letter, letter_id)
        if letter is None:
            raise ValueError("Letter not found")
        return letter

    def _get_consultant(self, consultant_id: int, department_id: int) -> User:
        consultant = self.db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == consultant_id)
        )
        if consultant is None:
            raise ValueError("Consultant not found")
        if consultant.department_id != department_id:
            raise ValueError("Consultant must belong to the same department as letter")
        if not self._has_role(consultant, Roles.CONSULTANT):
            raise ValueError("Selected user is not a consultant")
        return consultant

    def _validate_deadline(self, deadline_at: datetime) -> None:
        if deadline_at <= datetime.now(timezone.utc):
            raise ValueError("Deadline must be in the future")

    def _record_action(self, letter_id: int, action: LetterActionType, comment: str, acted_by: int) -> None:
        self.db.add(
            LetterAction(
                letter_id=letter_id,
                action=action,
                comment=comment,
                acted_by=acted_by,
            )
        )

    def _deactivate_current_assignment(self, letter_id: int) -> LetterAssignment | None:
        current = self.db.scalar(
            select(LetterAssignment)
            .where(LetterAssignment.letter_id == letter_id, LetterAssignment.is_active.is_(True))
            .order_by(LetterAssignment.id.desc())
        )
        if current:
            current.is_active = False
        return current

    def assign_consultant(
        self,
        letter_id: int,
        consultant_id: int,
        deadline_at: datetime,
        comment: str,
        current_user: User,
    ) -> LetterAssignment:
        letter = self._get_letter(letter_id)
        assert_assigning_user_can_access_letter(current_user, letter)
        self._validate_deadline(deadline_at)
        self._get_consultant(consultant_id, letter.department_id)
        current = self.db.scalar(
            select(LetterAssignment)
            .where(LetterAssignment.letter_id == letter_id, LetterAssignment.is_active.is_(True))
            .order_by(LetterAssignment.id.desc())
        )
        if current is not None:
            raise ValueError("Letter already assigned. Use reassign endpoint")

        assignment = LetterAssignment(
            letter_id=letter_id,
            consultant_id=consultant_id,
            assigned_by=current_user.id,
            deadline_at=deadline_at,
            is_active=True,
        )
        letter.status = LetterStatus.UNDER_REVIEW
        self.db.add(assignment)
        self._record_action(letter_id, LetterActionType.ASSIGN_CONSULTANT, comment, current_user.id)
        ActivityService(self.db).create_notification(
            user_id=consultant_id,
            kind=NotificationKind.ASSIGNMENT,
            title=f"New assignment: {letter.serial_no}",
            body=letter.subject,
            letter_id=letter_id,
            link_path=f"/letters/{letter_id}",
        )
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def reassign_consultant(
        self,
        letter_id: int,
        consultant_id: int,
        deadline_at: datetime,
        comment: str,
        current_user: User,
    ) -> LetterAssignment:
        letter = self._get_letter(letter_id)
        assert_assigning_user_can_access_letter(current_user, letter)
        self._validate_deadline(deadline_at)
        self._get_consultant(consultant_id, letter.department_id)
        current = self._deactivate_current_assignment(letter_id)
        if current is None:
            raise ValueError("No active assignment found. Use assign endpoint first")

        assignment = LetterAssignment(
            letter_id=letter_id,
            consultant_id=consultant_id,
            assigned_by=current_user.id,
            deadline_at=deadline_at,
            is_active=True,
        )
        self.db.add(assignment)
        self._record_action(letter_id, LetterActionType.REASSIGN_CONSULTANT, comment, current_user.id)
        ActivityService(self.db).create_notification(
            user_id=consultant_id,
            kind=NotificationKind.REASSIGNMENT,
            title=f"Reassigned: {letter.serial_no}",
            body=letter.subject,
            letter_id=letter_id,
            link_path=f"/letters/{letter_id}",
        )
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def get_assignment_tracking(
        self, letter_id: int, viewer: User
    ) -> tuple[Letter, list[LetterAssignment]]:
        return self.get_assignment_tracking_paginated(
            letter_id, viewer, limit=200, offset=0
        )

    def get_assignment_tracking_paginated(
        self,
        letter_id: int,
        viewer: User,
        *,
        limit: int,
        offset: int,
    ) -> tuple[Letter, list[LetterAssignment]]:
        letter = self._get_letter(letter_id)
        if not can_view_letter(self.db, viewer, letter):
            raise ValueError("Letter not found")
        assignments = list(
            self.db.scalars(
                select(LetterAssignment)
                .where(LetterAssignment.letter_id == letter_id)
                .order_by(LetterAssignment.id.asc())
                .limit(limit)
                .offset(offset)
            ).all()
        )
        return letter, assignments
