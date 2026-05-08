"""UI / API screen keys for role-based access (Role Management matrix)."""

from typing import Final

from app.rbac.permissions import (
    PermissionKey as PK,
    PERMISSION_MATRIX_COLUMNS,
    all_known_permission_keys,
    expand_legacy_letters,
    expand_permission_keys,
)


class ScreenKey:
    """Stable route-guard aliases. Module strings remain valid in stored role grants."""

    DASHBOARD = "dashboard"
    LETTERS_VIEW = PK.LETTERS_VIEW
    LETTERS_CREATE = PK.LETTERS_CREATE
    APPROVAL = "approval"
    ASSIGNMENT = "assignment"
    CONSULTANT = "consultant"
    CLOSURE = "closure"
    REPORTS = "reports"
    USERS = "users"
    NOTIFICATIONS = "notifications"
    SECURITY = "security"
    ROLE_MANAGEMENT = "role_management"


LEGACY_LETTERS_SCREEN_KEY: Final[str] = "letters"


def default_screen_matrix() -> dict[str, frozenset[str]]:
    """role_name -> allowed permission / screen keys (canonical role names)."""
    sk = ScreenKey
    pk = PK
    admin_keys = all_known_permission_keys()
    return {
        "Receiving Officer": frozenset(
            {
                sk.DASHBOARD,
                pk.LETTERS_VIEW,
                pk.LETTERS_CREATE,
                sk.NOTIFICATIONS,
                pk.CLOSURE_VIEW,
            }
        ),
        "Approval Head-PEC": frozenset(
            {
                sk.DASHBOARD,
                pk.LETTERS_VIEW,
                sk.APPROVAL,
                sk.NOTIFICATIONS,
            }
        ),
        "Team Leader": frozenset(
            {
                sk.DASHBOARD,
                pk.LETTERS_VIEW,
                sk.ASSIGNMENT,
                sk.CLOSURE,
                sk.NOTIFICATIONS,
            }
        ),
        "Consultant": frozenset(
            {sk.DASHBOARD, sk.CONSULTANT, sk.CLOSURE, sk.REPORTS, sk.NOTIFICATIONS}
        ),
        "System Admin": frozenset(admin_keys),
    }


def matrix_columns_flat() -> list[tuple[str, str]]:
    """Flattened columns for simple tables: (key, header label)."""
    return [(key, f"{group} — {label}") for group, key, label in PERMISSION_MATRIX_COLUMNS]


def grants_for_matrix_response(raw_keys: set[str]) -> list[str]:
    """Checkbox state for Role Management (legacy module rows imply granular ticks)."""
    return sorted(expand_permission_keys(expand_legacy_letters(set(raw_keys))))


# Back-compat re-exports
MATRIX_COLUMNS: Final[list[tuple[str, str]]] = matrix_columns_flat()
ALL_SCREEN_KEYS: Final[tuple[str, ...]] = tuple(sorted(all_known_permission_keys()))
