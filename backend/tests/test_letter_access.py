from unittest.mock import MagicMock

import pytest

from app.core.letter_access import (
    assert_assigning_user_can_access_letter,
    assert_user_can_create_in_department,
    is_admin,
    letter_visibility_clause,
)
from app.rbac.roles import Roles


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


def test_assign_team_lead_wrong_department():
    lead = MagicMock()
    lead.roles = [_Role(Roles.TEAM_LEADER)]
    lead.department_id = 1
    letter = MagicMock()
    letter.department_id = 2
    with pytest.raises(ValueError, match="outside your department"):
        assert_assigning_user_can_access_letter(lead, letter)


def test_assign_admin_ok():
    admin = MagicMock()
    admin.roles = [_Role(Roles.ADMIN)]
    letter = MagicMock()
    letter.department_id = 99
    assert_assigning_user_can_access_letter(admin, letter)
