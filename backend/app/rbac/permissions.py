"""Granular permission keys (view vs action) with legacy module expansion.

Legacy matrix tokens such as ``approval`` imply the full action bundle until operators
migrate roles to explicit granular grants."""

from __future__ import annotations

from typing import Final

# --- Canonical permission strings ---


class PermissionKey:
    DASHBOARD_VIEW = "dashboard:view"

    LETTERS_VIEW = "letters:view"
    LETTERS_CREATE = "letters:create"
    LETTERS_UPDATE = "letters:update"
    LETTERS_DELETE = "letters:delete"

    APPROVAL_VIEW = "approval:view"
    APPROVAL_APPROVE = "approval:approve"
    APPROVAL_REJECT = "approval:reject"
    APPROVAL_RETURN = "approval:return"
    APPROVAL_ROUTE = "approval:route"

    ASSIGNMENT_VIEW = "assignment:view"
    ASSIGNMENT_ASSIGN = "assignment:assign"
    ASSIGNMENT_REASSIGN = "assignment:reassign"

    CONSULTANT_VIEW = "consultant:view"
    CONSULTANT_UPDATE = "consultant:update"
    CONSULTANT_RESOLVE = "consultant:resolve"
    CONSULTANT_TRANSFER = "consultant:transfer"
    CONSULTANT_UPLOAD = "consultant:upload"

    CLOSURE_VIEW = "closure:view"
    CLOSURE_REVIEW = "closure:review"
    CLOSURE_CLOSE = "closure:close"

    REPORTS_VIEW = "reports:view"
    REPORTS_EXPORT = "reports:export"

    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"

    NOTIFICATIONS_VIEW = "notifications:view"
    SECURITY_VIEW = "security:view"
    ROLE_MANAGEMENT_VIEW = "role_management:view"


pk = PermissionKey

LEGACY_LETTERS_SCREEN_KEY: Final[str] = "letters"

# Single UI column = group label, permission key, checkbox label
PERMISSION_MATRIX_COLUMNS: Final[list[tuple[str, str, str]]] = [
    ("Dashboard", pk.DASHBOARD_VIEW, "View"),
    ("Letters", pk.LETTERS_VIEW, "View"),
    ("Letters", pk.LETTERS_CREATE, "Create"),
    ("Letters", pk.LETTERS_UPDATE, "Update"),
    ("Letters", pk.LETTERS_DELETE, "Delete"),
    ("Approval", pk.APPROVAL_VIEW, "View"),
    ("Approval", pk.APPROVAL_APPROVE, "Approve"),
    ("Approval", pk.APPROVAL_REJECT, "Reject"),
    ("Approval", pk.APPROVAL_RETURN, "Return"),
    ("Approval", pk.APPROVAL_ROUTE, "Route"),
    ("Assignment", pk.ASSIGNMENT_VIEW, "View"),
    ("Assignment", pk.ASSIGNMENT_ASSIGN, "Assign"),
    ("Assignment", pk.ASSIGNMENT_REASSIGN, "Reassign"),
    ("Consultant", pk.CONSULTANT_VIEW, "View"),
    ("Consultant", pk.CONSULTANT_UPDATE, "Update status"),
    ("Consultant", pk.CONSULTANT_RESOLVE, "Resolve"),
    ("Consultant", pk.CONSULTANT_TRANSFER, "Transfer"),
    ("Consultant", pk.CONSULTANT_UPLOAD, "Upload"),
    ("Closure", pk.CLOSURE_VIEW, "View"),
    ("Closure", pk.CLOSURE_REVIEW, "Review"),
    ("Closure", pk.CLOSURE_CLOSE, "Close"),
    ("Reports", pk.REPORTS_VIEW, "View"),
    ("Reports", pk.REPORTS_EXPORT, "Export"),
    ("Users", pk.USERS_VIEW, "View"),
    ("Users", pk.USERS_CREATE, "Create"),
    ("Users", pk.USERS_UPDATE, "Update"),
    ("Users", pk.USERS_DELETE, "Delete"),
    ("Notifications", pk.NOTIFICATIONS_VIEW, "View"),
    ("Security", pk.SECURITY_VIEW, "View logs"),
    ("Role management", pk.ROLE_MANAGEMENT_VIEW, "Manage roles"),
]

ALL_MATRIX_COLUMN_KEYS: Final[frozenset[str]] = frozenset(k for _, k, __ in PERMISSION_MATRIX_COLUMNS)

LEGACY_MODULE_IMPLIED_PERMISSIONS: Final[dict[str, frozenset[str]]] = {
    # Legacy screen token ``dashboard`` (used in older defaults / seeds)
    "dashboard": frozenset({pk.DASHBOARD_VIEW}),
    "approval": frozenset(
        {
            pk.APPROVAL_VIEW,
            pk.APPROVAL_APPROVE,
            pk.APPROVAL_REJECT,
            pk.APPROVAL_RETURN,
            pk.APPROVAL_ROUTE,
        }
    ),
    "assignment": frozenset({pk.ASSIGNMENT_VIEW, pk.ASSIGNMENT_ASSIGN, pk.ASSIGNMENT_REASSIGN}),
    "consultant": frozenset(
        {
            pk.CONSULTANT_VIEW,
            pk.CONSULTANT_UPDATE,
            pk.CONSULTANT_RESOLVE,
            pk.CONSULTANT_TRANSFER,
            pk.CONSULTANT_UPLOAD,
        }
    ),
    "closure": frozenset({pk.CLOSURE_VIEW, pk.CLOSURE_REVIEW, pk.CLOSURE_CLOSE}),
    "reports": frozenset({pk.REPORTS_VIEW, pk.REPORTS_EXPORT}),
    "users": frozenset({pk.USERS_VIEW, pk.USERS_CREATE, pk.USERS_UPDATE, pk.USERS_DELETE}),
    "notifications": frozenset({pk.NOTIFICATIONS_VIEW}),
    "security": frozenset({pk.SECURITY_VIEW}),
    "role_management": frozenset({pk.ROLE_MANAGEMENT_VIEW}),
}

# Legacy module screen token -> minimum view permission for route/menu checks
LEGACY_SCREEN_TO_VIEW_PERMISSION: Final[dict[str, str]] = {
    "dashboard": pk.DASHBOARD_VIEW,
    "approval": pk.APPROVAL_VIEW,
    "assignment": pk.ASSIGNMENT_VIEW,
    "consultant": pk.CONSULTANT_VIEW,
    "closure": pk.CLOSURE_VIEW,
    "reports": pk.REPORTS_VIEW,
    "users": pk.USERS_VIEW,
    "notifications": pk.NOTIFICATIONS_VIEW,
    "security": pk.SECURITY_VIEW,
    "role_management": pk.ROLE_MANAGEMENT_VIEW,
}


def expand_legacy_letters(keys: set[str]) -> set[str]:
    """Map legacy single ``letters`` permission to view + create."""
    out = set(keys)
    if LEGACY_LETTERS_SCREEN_KEY in out:
        out.discard(LEGACY_LETTERS_SCREEN_KEY)
        out.add(PermissionKey.LETTERS_VIEW)
        out.add(PermissionKey.LETTERS_CREATE)
    return out


def expand_permission_keys(raw: set[str]) -> set[str]:
    """Merge granular permissions implied by legacy module grants."""
    out = expand_legacy_letters(set(raw))
    for k in list(out):
        implied = LEGACY_MODULE_IMPLIED_PERMISSIONS.get(k)
        if implied:
            out.update(implied)
    return out


def all_known_permission_keys() -> frozenset[str]:
    """Every permission string the system understands (matrix + legacy module aliases)."""
    legacy = frozenset(LEGACY_MODULE_IMPLIED_PERMISSIONS.keys())
    return ALL_MATRIX_COLUMN_KEYS | legacy | frozenset({LEGACY_LETTERS_SCREEN_KEY})
