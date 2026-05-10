from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.upload_utils import save_upload_streaming
from app.models.letter import (
    AssignmentSolutionFile,
    AssignmentWorkStatus,
    Letter,
    LetterAction,
    LetterActionType,
    LetterAssignment,
    LetterStatus,
)
from app.models.user import User
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles, has_role_name
from app.services.activity_service import ActivityService
from app.models.activity import NotificationKind
from app.services.assignment_service import AssignmentService
from app.services.permission_service import PermissionService


class ConsultantService:
    def __init__(self, db: Session):
        self.db = db
        self.solution_dir = Path(settings.solution_upload_dir)
        self.solution_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _has_role(user: User, role_name: str) -> bool:
        return has_role_name(user, role_name)

    def _get_assignment_for_consultant(self, assignment_id: int, consultant_user: User) -> LetterAssignment:
        assignment = self.db.scalar(
            select(LetterAssignment).where(
                LetterAssignment.id == assignment_id,
                LetterAssignment.consultant_id == consultant_user.id,
                LetterAssignment.is_active.is_(True),
            )
        )
        if assignment is None:
            raise ValueError("Active assignment not found for this consultant")
        return assignment

    def _record_action(self, letter_id: int, action: LetterActionType, comment: str, acted_by: int) -> None:
        self.db.add(
            LetterAction(
                letter_id=letter_id,
                action=action,
                comment=comment,
                acted_by=acted_by,
            )
        )

    def list_assigned_letters(
        self,
        consultant_user: User,
        limit: int,
        offset: int,
        *,
        q: str | None = None,
        from_office: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        work_status: AssignmentWorkStatus | None = None,
    ) -> tuple[list[tuple[LetterAssignment, Letter]], int]:
        stmt = (
            select(LetterAssignment, Letter)
            .join(Letter, Letter.id == LetterAssignment.letter_id)
            .options(selectinload(Letter.department))
        )
        count_stmt = (
            select(func.count(LetterAssignment.id))
            .select_from(LetterAssignment)
            .join(Letter, Letter.id == LetterAssignment.letter_id)
        )
        filters = [
            LetterAssignment.consultant_id == consultant_user.id,
            LetterAssignment.is_active.is_(True),
        ]
        if q:
            qv = f"%{q.strip()}%"
            filters.append(
                or_(
                    Letter.serial_no.ilike(qv),
                    Letter.memo_no.ilike(qv),
                    Letter.subject.ilike(qv),
                )
            )
        if from_office:
            filters.append(Letter.received_from.ilike(f"%{from_office.strip()}%"))
        if date_from is not None:
            start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
            filters.append(Letter.created_at >= start)
        if date_to is not None:
            end = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
            filters.append(Letter.created_at <= end)
        if work_status is not None:
            filters.append(LetterAssignment.work_status == work_status)
        stmt = stmt.where(*filters).order_by(
            LetterAssignment.updated_at.desc(),
            LetterAssignment.assigned_at.desc(),
            LetterAssignment.id.desc(),
        )
        count_stmt = count_stmt.where(*filters)
        total = self.db.scalar(count_stmt) or 0
        items = list(self.db.execute(stmt.limit(limit).offset(offset)).all())
        return items, total

    def update_status(
        self,
        assignment_id: int,
        work_status: AssignmentWorkStatus,
        comment: str,
        consultant_user: User,
    ) -> LetterAssignment:
        assignment = self._get_assignment_for_consultant(assignment_id, consultant_user)
        assignment.work_status = work_status
        assignment.updated_at = datetime.now(timezone.utc)
        self._record_action(assignment.letter_id, LetterActionType.CONSULTANT_STATUS_UPDATE, comment, consultant_user.id)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def add_resolution_note(
        self,
        assignment_id: int,
        resolution_note: str,
        comment: str,
        consultant_user: User,
    ) -> LetterAssignment:
        assignment = self._get_assignment_for_consultant(assignment_id, consultant_user)
        assignment.resolution_note = resolution_note
        assignment.updated_at = datetime.now(timezone.utc)
        self._record_action(assignment.letter_id, LetterActionType.RESOLUTION_NOTE, comment, consultant_user.id)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def upload_solution_file(
        self,
        assignment_id: int,
        file: UploadFile,
        comment: str,
        consultant_user: User,
    ) -> AssignmentSolutionFile:
        assignment = self._get_assignment_for_consultant(assignment_id, consultant_user)
        filename = (file.filename or "").lower()
        allowed = (
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".doc",
            ".docx",
        )
        ext = next((e for e in allowed if filename.endswith(e)), None)
        if ext is None:
            raise ValueError(
                "Allowed solution file types: PDF, PNG, JPG, GIF, WEBP, DOC, DOCX"
            )
        path = self.solution_dir / f"assign-{assignment_id}-{uuid4().hex}{ext}"
        save_upload_streaming(
            file,
            path,
            max_bytes=settings.max_solution_upload_bytes,
        )

        solution = AssignmentSolutionFile(
            assignment_id=assignment_id,
            file_path=str(path),
            uploaded_by=consultant_user.id,
        )
        assignment.updated_at = datetime.now(timezone.utc)
        self.db.add(solution)
        self._record_action(assignment.letter_id, LetterActionType.SOLUTION_FILE_UPLOAD, comment, consultant_user.id)
        self.db.commit()
        self.db.refresh(solution)
        return solution

    def _transfer_target_role_label(self, target: User) -> str:
        if has_role_name(target, Roles.TEAM_LEADER):
            return "Team Leader"
        if has_role_name(target, Roles.CONSULTANT):
            return "Consultant"
        ps = PermissionService(self.db)
        if ps.user_has_permission(target, PermissionKey.ASSIGNMENT_VIEW):
            return "Team Leader"
        return "Consultant"

    def transfer_assignment(
        self,
        assignment_id: int,
        target_user_id: int,
        comment: str,
        consultant_user: User,
        deadline_at: datetime | None = None,
    ) -> LetterAssignment:
        assignment = self._get_assignment_for_consultant(assignment_id, consultant_user)
        assign_service = AssignmentService(self.db)
        target = assign_service.validate_transfer_target_user(target_user_id)
        if target.id == consultant_user.id:
            raise ValueError("Cannot transfer to yourself")
        if target.id == assignment.consultant_id:
            raise ValueError("That user already holds the active assignment for this letter.")

        letter = self.db.get(Letter, assignment.letter_id)
        if letter is None:
            raise ValueError("Letter not found")
        if letter.status in (LetterStatus.CLOSED, LetterStatus.REJECTED):
            raise ValueError("Cannot transfer a closed or rejected letter")

        role_label = self._transfer_target_role_label(target)

        dept_name = (
            target.department.name
            if getattr(target, "department", None) is not None
            else "No department"
        )
        stored_comment = (
            f"Transferred to: {target.full_name} — {role_label} — {dept_name}\n\n{comment.strip()}"
        )

        assignment.is_active = False
        assignment.work_status = AssignmentWorkStatus.TRANSFERRED
        assignment.updated_at = datetime.now(timezone.utc)

        new_deadline = deadline_at if deadline_at is not None else assignment.deadline_at
        assign_service._validate_deadline(new_deadline)

        new_assignment = LetterAssignment(
            letter_id=assignment.letter_id,
            consultant_id=target.id,
            assigned_by=consultant_user.id,
            deadline_at=new_deadline,
            is_active=True,
            work_status=AssignmentWorkStatus.ASSIGNED,
        )
        self.db.add(new_assignment)
        self._record_action(
            assignment.letter_id,
            LetterActionType.TRANSFER_ASSIGNMENT,
            stored_comment,
            consultant_user.id,
        )
        link_path = AssignmentService._notification_link_for_assignee(letter.id, target)
        note_preview = (comment.strip()[:280] + "…") if len(comment.strip()) > 280 else comment.strip()
        body_lines = [letter.subject, "", f"From: {consultant_user.full_name}", f"Note: {note_preview}"]
        route_mod = "consultant" if "/consultant/" in link_path else "assignment"
        ActivityService(self.db).create_notification(
            user_id=target.id,
            kind=NotificationKind.REASSIGNMENT,
            title=f"Assignment transferred: {letter.serial_no}",
            body="\n".join(body_lines),
            letter_id=letter.id,
            link_path=link_path,
            event_code="assignment.transfer",
            route_module=route_mod,
            entity_type="letter",
            entity_id=letter.id,
        )
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ValueError(
                "This letter’s active assignment changed while saving (for example, a concurrent "
                "assign or transfer). Refresh the page and try again."
            ) from None
        self.db.refresh(new_assignment)
        return new_assignment
