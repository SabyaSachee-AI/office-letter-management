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
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles, expand_role_names, is_system_admin, user_role_names
from app.services.activity_service import ActivityService
from app.services.permission_service import PermissionService


class ClosureService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _is_admin(user: User) -> bool:
        return is_system_admin(user)

    def _can_review_closure_actions(self, user: User) -> bool:
        if is_system_admin(user):
            return True
        if user_role_names(user) & expand_role_names(Roles.TEAM_LEADER):
            return True
        return PermissionService(self.db).user_has_permission(user, PermissionKey.CLOSURE_REVIEW)

    def _can_perform_formal_close(self, user: User) -> bool:
        if is_system_admin(user):
            return True
        if user_role_names(user) & expand_role_names(Roles.TEAM_LEADER):
            return True
        return PermissionService(self.db).user_has_permission(user, PermissionKey.CLOSURE_CLOSE)

    def _can_view_history(self, user: User) -> bool:
        if is_system_admin(user):
            return True
        if user_role_names(user) & expand_role_names(
            Roles.APPROVAL_HEAD_PEC,
            Roles.TEAM_LEADER,
            Roles.RECEIVING_OFFICER,
            Roles.CONSULTANT,
        ):
            return True
        svc = PermissionService(self.db)
        if svc.user_has_permission(user, PermissionKey.APPROVAL_VIEW):
            return True
        if svc.user_has_permission(user, PermissionKey.ASSIGNMENT_VIEW):
            return True
        return svc.user_has_permission(user, PermissionKey.CLOSURE_VIEW)

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
        """Latest active assignment (single-holder model)."""
        return self.db.scalars(
            select(LetterAssignment)
            .options(selectinload(LetterAssignment.files))
            .where(
                LetterAssignment.letter_id == letter_id,
                LetterAssignment.is_active.is_(True),
            )
            .order_by(LetterAssignment.id.desc())
            .limit(1)
        ).first()

    def _all_active_assignments(self, letter_id: int) -> list[LetterAssignment]:
        return list(
            self.db.scalars(
                select(LetterAssignment).where(
                    LetterAssignment.letter_id == letter_id,
                    LetterAssignment.is_active.is_(True),
                )
            ).all()
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
        if not self._can_review_closure_actions(user):
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
        if not self._can_review_closure_actions(user):
            raise ValueError("Insufficient role to add final comment")
        letter = self._get_letter(letter_id)
        self._assert_department_access(letter, user)
        if letter.status == LetterStatus.CLOSED:
            raise ValueError("Letter is already closed")

        self._append_action(letter_id, LetterActionType.FINAL_COMMENT, comment.strip(), user.id)
        self.db.commit()
        return self._get_letter(letter_id)

    def close_issue(self, letter_id: int, final_comment: str, user: User) -> Letter:
        if not self._can_perform_formal_close(user):
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

        for assignment in self._all_active_assignments(letter_id):
            assignment.is_active = False
            assignment.work_status = AssignmentWorkStatus.RESOLVED
            assignment.updated_at = datetime.now(timezone.utc)

        related_user_ids: list[int] = []
        all_assignments = list(
            self.db.scalars(
                select(LetterAssignment).where(LetterAssignment.letter_id == letter.id)
            ).all()
        )
        for a in all_assignments:
            related_user_ids.append(a.consultant_id)
            related_user_ids.append(a.assigned_by)

        ActivityService(self.db).notify_receiving_and_related_on_close(
            letter_id=letter.id,
            serial_no=letter.serial_no,
            subject=letter.subject,
            creator_user_id=letter.created_by,
            related_user_ids=related_user_ids,
            exclude_user_ids={user.id},
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
