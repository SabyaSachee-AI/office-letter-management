from datetime import date, datetime, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.department import Department
from app.models.letter import Letter, LetterAction, LetterActionType, LetterPriority, LetterStatus
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
        status: LetterStatus | None = None,
        department_id: int | None = None,
        from_office: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        q: str | None = None,
    ) -> tuple[list[Letter], int]:
        queue_statuses = (
            LetterStatus.RECEIVED,
            LetterStatus.RETURNED_FOR_CORRECTION,
        )
        conds = [Letter.status.in_(queue_statuses)]
        if status is not None:
            conds.append(Letter.status == status)
        if department_id is not None:
            conds.append(Letter.department_id == department_id)
        if from_office:
            conds.append(Letter.received_from.ilike(f"%{from_office.strip()}%"))
        if date_from is not None:
            start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
            conds.append(Letter.created_at >= start)
        if date_to is not None:
            end = datetime(
                date_to.year, date_to.month, date_to.day, 23, 59, 59, 999999, tzinfo=timezone.utc
            )
            conds.append(Letter.created_at <= end)
        if q:
            qv = f"%{q.strip()}%"
            conds.append(
                or_(
                    Letter.serial_no.ilike(qv),
                    Letter.memo_no.ilike(qv),
                    Letter.subject.ilike(qv),
                )
            )
        where_clause = and_(*conds)
        base = select(Letter).where(where_clause)
        count_stmt = select(func.count(Letter.id)).where(where_clause)
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

    def approve(
        self,
        letter_id: int,
        comment: str,
        user: User,
        *,
        target_department_id: int | None = None,
        priority: LetterPriority | None = None,
    ) -> Letter:
        letter = self._get_letter_for_department(letter_id, user)
        if letter.status in (LetterStatus.REJECTED, LetterStatus.CLOSED):
            raise ValueError("This letter cannot be approved anymore")
        if target_department_id is not None:
            target = self.db.get(Department, target_department_id)
            if target is None:
                raise ValueError("Target department not found")
            letter.department_id = target.id
        if priority is not None:
            letter.priority = priority
        if letter.department_id is None:
            raise ValueError("Department is required before approval")
        letter.status = LetterStatus.PROCESSED
        self._record_action(
            letter,
            LetterActionType.APPROVE,
            comment,
            user,
            letter.department_id,
            letter.department_id,
        )
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
