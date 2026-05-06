from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func, or_, select
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
)
from app.models.user import User
from app.rbac.roles import Roles, has_role_name


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
        work_status: AssignmentWorkStatus | None = None,
    ) -> tuple[list[tuple[LetterAssignment, Letter]], int]:
        stmt = select(LetterAssignment, Letter).join(
            Letter, Letter.id == LetterAssignment.letter_id
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
                    Letter.received_from.ilike(qv),
                )
            )
        if work_status is not None:
            filters.append(LetterAssignment.work_status == work_status)
        stmt = stmt.where(*filters).order_by(LetterAssignment.deadline_at.asc())
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

    def transfer_assignment(
        self,
        assignment_id: int,
        target_consultant_id: int,
        comment: str,
        consultant_user: User,
    ) -> LetterAssignment:
        assignment = self._get_assignment_for_consultant(assignment_id, consultant_user)
        target = self.db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == target_consultant_id)
        )
        if target is None:
            raise ValueError("Target consultant not found")
        if target.id == consultant_user.id:
            raise ValueError("Cannot transfer to same consultant")
        if target.department_id != consultant_user.department_id:
            raise ValueError("Target consultant must be in same department")
        if not self._has_role(target, Roles.CONSULTANT):
            raise ValueError("Target user is not a consultant")

        assignment.is_active = False
        assignment.work_status = AssignmentWorkStatus.TRANSFERRED
        assignment.updated_at = datetime.now(timezone.utc)

        new_assignment = LetterAssignment(
            letter_id=assignment.letter_id,
            consultant_id=target.id,
            assigned_by=consultant_user.id,
            deadline_at=assignment.deadline_at,
            is_active=True,
            work_status=AssignmentWorkStatus.ASSIGNED,
        )
        self.db.add(new_assignment)
        self._record_action(assignment.letter_id, LetterActionType.TRANSFER_ASSIGNMENT, comment, consultant_user.id)
        self.db.commit()
        self.db.refresh(new_assignment)
        return new_assignment
