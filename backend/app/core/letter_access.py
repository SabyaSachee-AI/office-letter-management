"""Department and assignment-based visibility for letters."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.letter import Letter, LetterAssignment, LetterStatus
from app.models.user import User
from app.rbac.permissions import PermissionKey
from app.rbac.roles import Roles, has_role_name, is_system_admin
from app.services.permission_service import PermissionService


def is_admin(user: User) -> bool:
    return is_system_admin(user)


def is_receiving_officer(user: User) -> bool:
    return has_role_name(user, Roles.RECEIVING_OFFICER)


def is_approval_head_pec(user: User) -> bool:
    return has_role_name(user, Roles.APPROVAL_HEAD_PEC)


def _user_workflow_department_ids(user: User) -> set[int]:
    """Department IDs that scope a workflow user's letter visibility (HR + team routing)."""
    ids: set[int] = set()
    if user.department_id is not None:
        ids.add(user.department_id)
    if getattr(user, "team_department_id", None) is not None:
        ids.add(user.team_department_id)
    return ids


def _assigned_letter_ids_subquery(user_id: int):
    """Letters where this user is/was the assignee (includes closed / inactive rows)."""
    return (
        select(LetterAssignment.letter_id)
        .where(LetterAssignment.consultant_id == user_id)
        .distinct()
    )


def _user_recorded_as_assignment_assigner(db: Session, user: User, letter_id: int) -> bool:
    """True if this user posted an assign/reassign row on this letter (routing actor)."""
    return (
        db.scalar(
            select(LetterAssignment.id)
            .where(
                LetterAssignment.letter_id == letter_id,
                LetterAssignment.assigned_by == user.id,
            )
            .limit(1)
        )
        is not None
    )


def can_view_letter(db: Session, user: User, letter: Letter) -> bool:
    if is_admin(user):
        return True
    if is_receiving_officer(user):
        return True
    if is_approval_head_pec(user):
        return True
    # Matrix ``approval:view`` without legacy role name: only letters still in central approval queue.
    if letter.status in (LetterStatus.RECEIVED, LetterStatus.RETURNED_FOR_CORRECTION):
        if PermissionService(db).user_has_permission(user, PermissionKey.APPROVAL_VIEW):
            return True
    if letter.department_id is not None and letter.department_id in _user_workflow_department_ids(user):
        return True
    # After TL→TL forward then assign to consultant, the routing TL is no longer active assignee
    # and may not share letter.department_id (cross-team). They remain ``assigned_by`` on a row.
    if _user_recorded_as_assignment_assigner(db, user, letter.id):
        ps = PermissionService(db)
        if (
            has_role_name(user, Roles.TEAM_LEADER)
            or has_role_name(user, Roles.CONSULTANT)
            or ps.user_has_permission(user, PermissionKey.ASSIGNMENT_VIEW)
            or ps.user_has_permission(user, PermissionKey.CONSULTANT_VIEW)
        ):
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
    if is_receiving_officer(viewer):
        return None
    if is_approval_head_pec(viewer):
        return None
    assigned = _assigned_letter_ids_subquery(viewer.id)
    dept_ids = _user_workflow_department_ids(viewer)
    if dept_ids:
        return or_(Letter.department_id.in_(dept_ids), Letter.id.in_(assigned))
    return Letter.id.in_(assigned)


def assert_user_can_create_in_department(user: User, department_id: int | None) -> None:
    if is_admin(user):
        return
    if is_receiving_officer(user):
        return
    if department_id is None:
        raise ValueError("Department is required for this role")
    if user.department_id is None:
        raise ValueError("Your account has no department")
    if user.department_id != department_id:
        raise ValueError("You may only create letters for your own department")


def assert_assigning_user_can_access_letter(db: Session, user: User, letter: Letter) -> None:
    """May assign/forward when admin, active recipient on this letter, or TL with assign perms who can view."""
    if is_admin(user):
        return
    active = db.scalar(
        select(LetterAssignment.id)
        .where(
            LetterAssignment.letter_id == letter.id,
            LetterAssignment.consultant_id == user.id,
            LetterAssignment.is_active.is_(True),
        )
        .limit(1)
    )
    if active is not None:
        return
    ps = PermissionService(db)
    if has_role_name(user, Roles.TEAM_LEADER) and (
        ps.user_has_permission(user, PermissionKey.ASSIGNMENT_ASSIGN)
        or ps.user_has_permission(user, PermissionKey.ASSIGNMENT_REASSIGN)
    ):
        if can_view_letter(db, user, letter):
            return
    raise ValueError(
        "You cannot assign or forward this letter. You need an active assignment on it, "
        "or Team Leader assignment permissions with visibility on this letter."
    )
