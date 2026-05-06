"""Department and assignment-based visibility for letters."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.letter import Letter, LetterAssignment
from app.models.user import User
from app.rbac.roles import is_system_admin


def is_admin(user: User) -> bool:
    return is_system_admin(user)


def _assigned_letter_ids_subquery(user_id: int):
    return (
        select(LetterAssignment.letter_id)
        .where(LetterAssignment.consultant_id == user_id)
        .distinct()
    )


def can_view_letter(db: Session, user: User, letter: Letter) -> bool:
    if is_admin(user):
        return True
    if user.department_id is not None and letter.department_id == user.department_id:
        return True
    q = db.scalar(
        select(LetterAssignment.id)
        .where(
            LetterAssignment.letter_id == letter.id,
            LetterAssignment.consultant_id == user.id,
        )
        .limit(1)
    )
    return q is not None


def letter_visibility_clause(viewer: User):
    """Extra WHERE fragment for listing letters (non-admin callers). Admin returns None."""
    if is_admin(viewer):
        return None
    assigned = _assigned_letter_ids_subquery(viewer.id)
    if viewer.department_id is not None:
        return or_(Letter.department_id == viewer.department_id, Letter.id.in_(assigned))
    return Letter.id.in_(assigned)


def assert_user_can_create_in_department(user: User, department_id: int) -> None:
    if is_admin(user):
        return
    if user.department_id is None:
        raise ValueError(
            "Your account has no department; only administrators may choose the department"
        )
    if user.department_id != department_id:
        raise ValueError("You may only create letters for your own department")


def assert_assigning_user_can_access_letter(user: User, letter: Letter) -> None:
    """Team leads assigning consultants must belong to the letter's department (admins exempt)."""
    if is_admin(user):
        return
    if user.department_id is None:
        raise ValueError("User has no department")
    if letter.department_id != user.department_id:
        raise ValueError("Letter is outside your department")
