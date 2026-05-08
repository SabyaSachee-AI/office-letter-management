"""Create and validate custom (non–built-in) roles without breaking system roles."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.role_screen_permission import RoleScreenPermission
from app.rbac.roles import RESERVED_ROLE_CODES, RESERVED_ROLE_DISPLAY_NAMES_LOWER


def derive_role_code_from_name(name: str) -> str:
    """Uppercase slug: letters, digits, underscores; no spaces."""
    raw = re.sub(r"[^\w\s-]", "", name.strip(), flags=re.UNICODE)
    raw = re.sub(r"[\s\-]+", "_", raw)
    code = raw.upper().strip("_")
    code = re.sub(r"[^A-Z0-9_]", "_", code)
    code = code.strip("_")
    if not code:
        raise ValueError("Enter a role name that yields a valid code (letters or numbers).")
    if code[0].isdigit():
        code = f"R_{code}"
    code = code[:40]
    return code


def validate_custom_role_code(code: str) -> str:
    c = code.strip().upper()
    if len(c) < 2 or len(c) > 40:
        raise ValueError("Role code must be between 2 and 40 characters.")
    if not re.match(r"^[A-Z][A-Z0-9_]*$", c):
        raise ValueError("Role code must be uppercase letters, digits, and underscores only (no spaces).")
    if c in RESERVED_ROLE_CODES:
        raise ValueError("This role code is reserved for a system role.")
    return c


def validate_custom_role_name(name: str) -> str:
    n = name.strip()
    if len(n) < 2 or len(n) > 80:
        raise ValueError("Role name must be between 2 and 80 characters.")
    if n.lower() in RESERVED_ROLE_DISPLAY_NAMES_LOWER:
        raise ValueError("This role name is reserved for a system role.")
    return n


def create_custom_role(
    db: Session,
    *,
    name: str,
    code: str | None,
    description: str | None,
    clone_from_role_id: int | None,
    is_active: bool,
) -> Role:
    display_name = validate_custom_role_name(name)
    final_code = validate_custom_role_code(code or derive_role_code_from_name(display_name))

    dup_name = db.scalar(select(Role.id).where(Role.name == display_name))
    if dup_name is not None:
        raise ValueError("A role with this name already exists.")

    dup_code = db.scalar(select(Role.id).where(Role.code == final_code))
    if dup_code is not None:
        raise ValueError("A role with this code already exists.")

    if clone_from_role_id is not None:
        src = db.get(Role, clone_from_role_id)
        if src is None:
            raise ValueError("Clone-from role was not found.")

    next_sort = db.scalar(select(func.max(Role.sort_order))) or 100
    role = Role(
        name=display_name,
        code=final_code,
        description=(description.strip() if description else None) or None,
        is_system_role=False,
        is_active=is_active,
        sort_order=int(next_sort) + 1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(role)
    db.flush()

    if clone_from_role_id is not None:
        keys = list(
            db.scalars(
                select(RoleScreenPermission.screen_key).where(
                    RoleScreenPermission.role_id == clone_from_role_id
                )
            ).all()
        )
        for key in keys:
            db.add(RoleScreenPermission(role_id=role.id, screen_key=key))

    return role
