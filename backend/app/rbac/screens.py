"""UI / API screen keys for role-based access (Role Management matrix)."""

from typing import Final

# Align with permission matrix columns (Overview = dashboard home).
class ScreenKey:
    DASHBOARD = "dashboard"
    # Split letter access: view vs register (create)
    LETTERS_VIEW = "letters:view"
    LETTERS_CREATE = "letters:create"
    APPROVAL = "approval"
    ASSIGNMENT = "assignment"
    CONSULTANT = "consultant"
    CLOSURE = "closure"
    REPORTS = "reports"
    USERS = "users"
    NOTIFICATIONS = "notifications"
    SECURITY = "security"
    ROLE_MANAGEMENT = "role_management"


# DB rows may still use this from older seeds; treated as both view + create.
LEGACY_LETTERS_SCREEN_KEY: Final[str] = "letters"


MATRIX_COLUMNS: Final[list[tuple[str, str]]] = [
    (ScreenKey.DASHBOARD, "Dashboard"),
    (ScreenKey.LETTERS_VIEW, "Letters (view only)"),
    (ScreenKey.LETTERS_CREATE, "Letters (create)"),
    (ScreenKey.APPROVAL, "Approval"),
    (ScreenKey.ASSIGNMENT, "Assignment"),
    (ScreenKey.CONSULTANT, "Consultant"),
    (ScreenKey.CLOSURE, "Closure"),
    (ScreenKey.REPORTS, "Reports"),
    (ScreenKey.USERS, "Users"),
    (ScreenKey.NOTIFICATIONS, "Notifications"),
    (ScreenKey.SECURITY, "Security Logs"),
]

ALL_SCREEN_KEYS: Final[tuple[str, ...]] = tuple(k for k, _ in MATRIX_COLUMNS) + (
    ScreenKey.ROLE_MANAGEMENT,
)


def expand_legacy_letters(keys: set[str]) -> set[str]:
    """Map legacy single 'letters' permission to view + create."""
    out = set(keys)
    if LEGACY_LETTERS_SCREEN_KEY in out:
        out.discard(LEGACY_LETTERS_SCREEN_KEY)
        out.add(ScreenKey.LETTERS_VIEW)
        out.add(ScreenKey.LETTERS_CREATE)
    return out


def default_screen_matrix() -> dict[str, frozenset[str]]:
    """role_name -> allowed screen keys (canonical role names)."""
    sk = ScreenKey
    return {
        "Receiving Officer": frozenset(
            {
                sk.DASHBOARD,
                sk.LETTERS_VIEW,
                sk.LETTERS_CREATE,
                sk.NOTIFICATIONS,
            }
        ),
        "Approval Head-PEC": frozenset(
            {
                sk.DASHBOARD,
                sk.LETTERS_VIEW,
                sk.APPROVAL,
                sk.NOTIFICATIONS,
            }
        ),
        "Team Leader": frozenset(
            {
                sk.DASHBOARD,
                sk.LETTERS_VIEW,
                sk.ASSIGNMENT,
                sk.CLOSURE,
                sk.NOTIFICATIONS,
            }
        ),
        "Consultant": frozenset(
            {sk.DASHBOARD, sk.CONSULTANT, sk.REPORTS, sk.NOTIFICATIONS}
        ),
        "System Admin": frozenset(ALL_SCREEN_KEYS),
    }
