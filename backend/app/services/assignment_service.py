from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.letter_access import assert_assigning_user_can_access_letter, can_view_letter
from app.models.activity import NotificationKind
from app.models.letter import (
    AssignmentWorkStatus,
    Letter,
    LetterAction,
    LetterActionType,
    LetterAssignment,
    LetterStatus,
)
from app.models.user import User
from app.models.user import UserStatus
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles, has_role_name
from app.schemas.assignment import AssignmentOut, assignment_user_brief
from app.services.activity_service import ActivityService
from app.services.permission_service import PermissionService


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db

    def _commit_assignment_workflow(self) -> None:
        """Commit assignment changes; map unique-violation on active row to a friendly error."""
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ValueError(
                "This letter’s active assignment changed while saving (for example, a concurrent "
                "assign or transfer). Refresh the page and try again."
            ) from None

    @staticmethod
    def _notification_link_for_assignee(letter_id: int, assignee: User) -> str:
        """Team Leaders use the Assignment module; consultants use the Consultant workspace."""
        if has_role_name(assignee, Roles.TEAM_LEADER):
            return f"/dashboard/assignment/{letter_id}"
        return f"/dashboard/consultant/{letter_id}"

    def enrich_assignments(self, rows: list[LetterAssignment]) -> list[AssignmentOut]:
        if not rows:
            return []
        user_ids = {a.consultant_id for a in rows} | {a.assigned_by for a in rows}
        users_list = list(
            self.db.scalars(
                select(User)
                .where(User.id.in_(user_ids))
                .options(selectinload(User.roles), selectinload(User.department))
            ).all()
        )
        users_map = {u.id: u for u in users_list}
        out: list[AssignmentOut] = []
        for a in rows:
            base = AssignmentOut.model_validate(a).model_dump()
            cu = users_map.get(a.consultant_id)
            bu = users_map.get(a.assigned_by)
            base["consultant_user"] = assignment_user_brief(cu) if cu else None
            base["assigned_by_user"] = assignment_user_brief(bu) if bu else None
            out.append(AssignmentOut(**base))
        return out

    @staticmethod
    def _has_role(user: User, role_name: str) -> bool:
        return has_role_name(user, role_name)

    def _get_letter(self, letter_id: int) -> Letter:
        letter = self.db.get(Letter, letter_id)
        if letter is None:
            raise ValueError("Letter not found")
        return letter

    def _get_assignee(self, assignee_id: int) -> User:
        assignee = self.db.scalar(
            select(User)
            .options(selectinload(User.roles), selectinload(User.department))
            .where(User.id == assignee_id)
        )
        if assignee is None:
            raise ValueError("Assignee not found")
        if assignee.status != UserStatus.ACTIVE:
            raise ValueError("Assignee must be active")
        ps = PermissionService(self.db)
        ok_consultant = self._has_role(assignee, Roles.CONSULTANT) or ps.user_has_permission(
            assignee, PermissionKey.CONSULTANT_VIEW
        )
        ok_tl = self._has_role(assignee, Roles.TEAM_LEADER) or ps.user_has_permission(
            assignee, PermissionKey.ASSIGNMENT_VIEW
        )
        if not (ok_consultant or ok_tl):
            raise ValueError("Recipient must be an active Team Leader or Consultant")
        return assignee

    def validate_transfer_target_user(self, user_id: int) -> User:
        """Active user eligible to receive a consultant transfer (Consultant or Team Leader paths)."""
        assignee = self.db.scalar(
            select(User)
            .options(selectinload(User.roles), selectinload(User.department))
            .where(User.id == user_id)
        )
        if assignee is None:
            raise ValueError("Target user not found")
        if assignee.status != UserStatus.ACTIVE:
            raise ValueError("Target user must be active")
        ps = PermissionService(self.db)
        can_consultant = self._has_role(assignee, Roles.CONSULTANT) or ps.user_has_permission(
            assignee, PermissionKey.CONSULTANT_VIEW
        )
        can_tl = self._has_role(assignee, Roles.TEAM_LEADER) or ps.user_has_permission(
            assignee, PermissionKey.ASSIGNMENT_VIEW
        )
        if not (can_consultant or can_tl):
            raise ValueError(
                "Target must be eligible as a Consultant (consultant role or consultant:view) "
                "or Team Leader (team leader role or assignment:view)"
            )
        return assignee

    def _validate_deadline(self, deadline_at: datetime | None) -> None:
        if deadline_at is None:
            return
        if deadline_at.tzinfo is None:
            deadline_at = deadline_at.replace(tzinfo=timezone.utc)
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
            current.work_status = AssignmentWorkStatus.TRANSFERRED
            current.updated_at = datetime.now(timezone.utc)
        return current

    def assign_consultant(
        self,
        letter_id: int,
        recipient_user_id: int,
        deadline_at: datetime | None,
        comment: str,
        current_user: User,
    ) -> LetterAssignment:
        letter = self._get_letter(letter_id)
        if letter.department_id is None:
            raise ValueError("Letter department is pending assignment")
        assert_assigning_user_can_access_letter(self.db, current_user, letter)
        self._validate_deadline(deadline_at)
        assignee = self._get_assignee(recipient_user_id)
        current = self.db.scalar(
            select(LetterAssignment)
            .where(LetterAssignment.letter_id == letter_id, LetterAssignment.is_active.is_(True))
            .order_by(LetterAssignment.id.desc())
        )
        if current is not None:
            raise ValueError("Letter already assigned. Use reassign endpoint")

        assignment = LetterAssignment(
            letter_id=letter_id,
            consultant_id=recipient_user_id,
            assigned_by=current_user.id,
            deadline_at=deadline_at,
            is_active=True,
        )
        letter.status = LetterStatus.UNDER_REVIEW
        self.db.add(assignment)
        self._record_action(letter_id, LetterActionType.ASSIGN_CONSULTANT, comment, current_user.id)
        link = self._notification_link_for_assignee(letter_id, assignee)
        route_mod = "consultant" if "/consultant/" in link else "assignment"
        ActivityService(self.db).create_notification(
            user_id=recipient_user_id,
            kind=NotificationKind.ASSIGNMENT,
            title=f"New assignment: {letter.serial_no}",
            body=letter.subject,
            letter_id=letter_id,
            link_path=link,
            event_code="assignment.new",
            route_module=route_mod,
            entity_type="letter",
            entity_id=letter_id,
        )
        self._commit_assignment_workflow()
        self.db.refresh(assignment)
        return assignment

    def reassign_consultant(
        self,
        letter_id: int,
        recipient_user_id: int,
        deadline_at: datetime | None,
        comment: str,
        current_user: User,
    ) -> LetterAssignment:
        letter = self._get_letter(letter_id)
        if letter.department_id is None:
            raise ValueError("Letter department is pending assignment")
        assert_assigning_user_can_access_letter(self.db, current_user, letter)
        self._validate_deadline(deadline_at)
        assignee = self._get_assignee(recipient_user_id)
        current = self.db.scalar(
            select(LetterAssignment)
            .where(LetterAssignment.letter_id == letter_id, LetterAssignment.is_active.is_(True))
            .order_by(LetterAssignment.id.desc())
        )
        if current is None:
            raise ValueError("No active assignment found. Use assign endpoint first")
        if current.consultant_id == recipient_user_id:
            raise ValueError("That user already holds the active assignment for this letter.")

        current.is_active = False
        current.work_status = AssignmentWorkStatus.TRANSFERRED
        current.updated_at = datetime.now(timezone.utc)

        assignment = LetterAssignment(
            letter_id=letter_id,
            consultant_id=recipient_user_id,
            assigned_by=current_user.id,
            deadline_at=deadline_at,
            is_active=True,
        )
        self.db.add(assignment)
        self._record_action(letter_id, LetterActionType.REASSIGN_CONSULTANT, comment, current_user.id)
        link = self._notification_link_for_assignee(letter_id, assignee)
        route_mod = "consultant" if "/consultant/" in link else "assignment"
        ActivityService(self.db).create_notification(
            user_id=recipient_user_id,
            kind=NotificationKind.REASSIGNMENT,
            title=f"Reassigned: {letter.serial_no}",
            body=letter.subject,
            letter_id=letter_id,
            link_path=link,
            event_code="assignment.reassign",
            route_module=route_mod,
            entity_type="letter",
            entity_id=letter_id,
        )
        self._commit_assignment_workflow()
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
