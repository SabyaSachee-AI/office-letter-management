from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.letter_access import (
    assert_user_can_create_in_department,
    can_view_letter,
    letter_visibility_clause,
)
from app.core.upload_utils import save_upload_streaming
from app.models.department import Department
from app.models.letter import Letter, LetterPriority, LetterStatus
from app.models.user import User


class LetterService:
    def __init__(self, db: Session):
        self.db = db
        self.upload_dir = Path(settings.letter_upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _generate_serial_no(self) -> str:
        now = datetime.now(timezone.utc)
        date_part = now.strftime("%Y%m%d")
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        total_today = (
            self.db.scalar(
                select(func.count(Letter.id)).where(
                    Letter.created_at >= day_start,
                    Letter.created_at <= day_end,
                )
            )
            or 0
        )
        return f"LTR-{date_part}-{total_today + 1:04d}"

    _ALLOWED_EXT = (
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".doc",
        ".docx",
    )

    def _save_attachment(self, upload: UploadFile, serial_no: str) -> str:
        filename = upload.filename or ""
        lower = filename.lower()
        ext = next((e for e in self._ALLOWED_EXT if lower.endswith(e)), None)
        if ext is None:
            raise ValueError(
                "Allowed file types: PDF, PNG, JPG, GIF, WEBP, DOC, DOCX"
            )
        path = self.upload_dir / f"{serial_no}-{uuid4().hex}{ext}"
        save_upload_streaming(
            upload,
            path,
            max_bytes=settings.max_letter_upload_bytes,
        )
        return str(path)

    def create_letter(
        self,
        subject: str,
        received_from: str,
        department_id: int,
        priority: LetterPriority,
        file: UploadFile,
        created_by: User,
    ) -> Letter:
        assert_user_can_create_in_department(created_by, department_id)
        department = self.db.get(Department, department_id)
        if department is None:
            raise ValueError("Department not found")

        serial_no = self._generate_serial_no()
        pdf_path = self._save_attachment(file, serial_no)

        letter = Letter(
            serial_no=serial_no,
            subject=subject,
            received_from=received_from,
            department_id=department_id,
            priority=priority,
            pdf_path=pdf_path,
            created_by=created_by.id,
        )
        self.db.add(letter)
        self.db.commit()
        self.db.refresh(letter)
        return self.get_letter(letter.id)

    def get_letter(self, letter_id: int) -> Letter:
        letter = self.db.scalar(
            select(Letter)
            .options(selectinload(Letter.department))
            .where(Letter.id == letter_id)
        )
        if letter is None:
            raise ValueError("Letter not found")
        return letter

    def get_letter_for_user(self, letter_id: int, viewer: User) -> Letter:
        letter = self.get_letter(letter_id)
        if not can_view_letter(self.db, viewer, letter):
            raise ValueError("Letter not found")
        return letter

    def list_letters(
        self,
        viewer: User,
        limit: int,
        offset: int,
        *,
        status: LetterStatus | None = None,
        department_id: int | None = None,
        q: str | None = None,
    ) -> tuple[list[Letter], int]:
        base = select(Letter).options(selectinload(Letter.department))
        count_base = select(func.count(Letter.id))
        vis = letter_visibility_clause(viewer)
        if vis is not None:
            base = base.where(vis)
            count_base = count_base.where(vis)
        if status is not None:
            base = base.where(Letter.status == status)
            count_base = count_base.where(Letter.status == status)
        if department_id is not None:
            base = base.where(Letter.department_id == department_id)
            count_base = count_base.where(Letter.department_id == department_id)
        if q:
            qv = f"%{q.strip()}%"
            search_filter = or_(
                Letter.serial_no.ilike(qv),
                Letter.subject.ilike(qv),
                Letter.received_from.ilike(qv),
            )
            base = base.where(search_filter)
            count_base = count_base.where(search_filter)
        total = self.db.scalar(count_base) or 0
        items = list(
            self.db.scalars(
                base.order_by(Letter.id.desc()).limit(limit).offset(offset)
            ).all()
        )
        return items, total
