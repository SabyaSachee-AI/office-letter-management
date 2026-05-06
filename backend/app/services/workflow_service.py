from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.department import Department
from app.models.letter import Letter, LetterAction, LetterActionType, LetterStatus
from app.models.user import User
from app.rbac.roles import is_system_admin


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _is_admin(user: User) -> bool:
        return is_system_admin(user)

    def _get_letter_for_department(self, letter_id: int, user: User) -> Letter:
        letter = self.db.scalar(
            select(Letter)
            .options(selectinload(Letter.department), selectinload(Letter.actions))
            .where(Letter.id == letter_id)
        )
        if letter is None:
            raise ValueError("Letter not found")
        if not self._is_admin(user) and user.department_id is None:
            raise ValueError("Current user has no assigned department")
        if not self._is_admin(user) and letter.department_id != user.department_id:
            raise ValueError("Letter does not belong to your department")
        return letter

    def _record_action(
        self,
        letter: Letter,
        action: LetterActionType,
        comment: str,
        user: User,
        from_department_id: int | None = None,
        to_department_id: int | None = None,
    ) -> None:
        self.db.add(
            LetterAction(
                letter_id=letter.id,
                action=action,
                comment=comment,
                acted_by=user.id,
                from_department_id=from_department_id,
                to_department_id=to_department_id,
            )
        )

    def get_approval_queue(
        self,
        user: User,
        limit: int,
        offset: int,
        *,
        q: str | None = None,
    ) -> tuple[list[Letter], int]:
        if user.department_id is None and not self._is_admin(user):
            return [], 0
        queue_statuses = (
            LetterStatus.RECEIVED,
            LetterStatus.UNDER_REVIEW,
            LetterStatus.RETURNED_FOR_CORRECTION,
        )
        base = select(Letter).where(Letter.status.in_(queue_statuses))
        count_stmt = select(func.count(Letter.id)).where(Letter.status.in_(queue_statuses))
        if not self._is_admin(user):
            base = base.where(Letter.department_id == user.department_id)
            count_stmt = count_stmt.where(Letter.department_id == user.department_id)
        if q:
            qv = f"%{q.strip()}%"
            search_filter = or_(
                Letter.serial_no.ilike(qv),
                Letter.memo_no.ilike(qv),
                Letter.subject.ilike(qv),
                Letter.received_from.ilike(qv),
            )
            base = base.where(search_filter)
            count_stmt = count_stmt.where(search_filter)
        total = self.db.scalar(count_stmt) or 0
        items = list(
            self.db.scalars(
                base.options(selectinload(Letter.department))
                .order_by(Letter.id.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return items, total

    def approve(self, letter_id: int, comment: str, user: User) -> Letter:
        letter = self._get_letter_for_department(letter_id, user)
        if letter.status in (LetterStatus.REJECTED, LetterStatus.CLOSED):
            raise ValueError("This letter cannot be approved anymore")
        letter.status = LetterStatus.PROCESSED
        self._record_action(letter, LetterActionType.APPROVE, comment, user, letter.department_id, letter.department_id)
        self.db.commit()
        self.db.refresh(letter)
        return letter

    def reject(self, letter_id: int, comment: str, user: User) -> Letter:
        letter = self._get_letter_for_department(letter_id, user)
        if letter.status in (LetterStatus.PROCESSED, LetterStatus.CLOSED):
            raise ValueError("Processed/closed letter cannot be rejected")
        letter.status = LetterStatus.REJECTED
        self._record_action(letter, LetterActionType.REJECT, comment, user, letter.department_id, letter.department_id)
        self.db.commit()
        self.db.refresh(letter)
        return letter

    def return_for_correction(self, letter_id: int, comment: str, user: User) -> Letter:
        letter = self._get_letter_for_department(letter_id, user)
        if letter.status in (LetterStatus.REJECTED, LetterStatus.CLOSED):
            raise ValueError("This letter cannot be returned for correction")
        letter.status = LetterStatus.RETURNED_FOR_CORRECTION
        self._record_action(
            letter,
            LetterActionType.RETURN_FOR_CORRECTION,
            comment,
            user,
            letter.department_id,
            letter.department_id,
        )
        self.db.commit()
        self.db.refresh(letter)
        return letter

    def route_to_department(self, letter_id: int, target_department_id: int, comment: str, user: User) -> Letter:
        letter = self._get_letter_for_department(letter_id, user)
        target = self.db.get(Department, target_department_id)
        if target is None:
            raise ValueError("Target department not found")
        if target.id == letter.department_id:
            raise ValueError("Target department must be different")

        from_department_id = letter.department_id
        letter.department_id = target.id
        letter.status = LetterStatus.UNDER_REVIEW
        self._record_action(
            letter,
            LetterActionType.ROUTE,
            comment,
            user,
            from_department_id=from_department_id,
            to_department_id=target.id,
        )
        self.db.commit()
        self.db.refresh(letter)
        return letter
