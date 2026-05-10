from unittest.mock import MagicMock, patch

import pytest

from app.core.letter_access import (
    assert_assigning_user_can_access_letter,
    assert_user_can_create_in_department,
    is_admin,
    letter_visibility_clause,
)
from app.rbac.roles import Roles
from app.services.permission_service import PermissionService


class _Role:
    __slots__ = ("name",)

    def __init__(self, name: str) -> None:
        self.name = name


def test_is_admin_true():
    u = MagicMock()
    u.roles = [_Role(Roles.ADMIN)]
    assert is_admin(u) is True


def test_is_admin_false():
    u = MagicMock()
    u.roles = [_Role(Roles.CONSULTANT)]
    assert is_admin(u) is False


def test_letter_visibility_admin_no_extra_clause():
    u = MagicMock()
    u.roles = [_Role(Roles.ADMIN)]
    assert letter_visibility_clause(u) is None


def test_letter_visibility_non_admin_has_clause():
    u = MagicMock()
    u.id = 5
    u.roles = [_Role(Roles.RECEIVING_OFFICER)]
    u.department_id = 3
    clause = letter_visibility_clause(u)
    assert clause is None


def test_letter_visibility_approval_head_pec_no_extra_clause():
    u = MagicMock()
    u.id = 7
    u.roles = [_Role(Roles.APPROVAL_HEAD_PEC)]
    u.department_id = 2
    assert letter_visibility_clause(u) is None


def test_create_letter_receiving_officer_allows_null_or_any_department():
    u = MagicMock()
    u.roles = [_Role(Roles.RECEIVING_OFFICER)]
    u.department_id = 1
    assert_user_can_create_in_department(u, None)
    assert_user_can_create_in_department(u, 99)


@patch("app.core.letter_access.can_view_letter", return_value=False)
@patch.object(PermissionService, "user_has_permission", return_value=True)
def test_assign_team_lead_wrong_department(_mock_perm, _mock_cv):
    db = MagicMock()
    db.scalar = MagicMock(return_value=None)
    lead = MagicMock()
    lead.roles = [_Role(Roles.TEAM_LEADER)]
    lead.department_id = 1
    lead.team_department_id = None
    letter = MagicMock()
    letter.id = 99
    letter.department_id = 2
    with pytest.raises(ValueError, match="cannot assign or forward"):
        assert_assigning_user_can_access_letter(db, lead, letter)


def test_assign_team_lead_ok_when_active_recipient_other_department():
    db = MagicMock()
    db.scalar = MagicMock(return_value=99)
    lead = MagicMock()
    lead.roles = [_Role(Roles.TEAM_LEADER)]
    lead.department_id = 1
    lead.team_department_id = None
    letter = MagicMock()
    letter.department_id = 999
    assert_assigning_user_can_access_letter(db, lead, letter)


def test_assign_admin_ok():
    admin = MagicMock()
    admin.roles = [_Role(Roles.ADMIN)]
    letter = MagicMock()
    letter.department_id = 99
    db = MagicMock()
    assert_assigning_user_can_access_letter(db, admin, letter)
